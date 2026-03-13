// NO Math.random() — simulation must be deterministic

import type {
  GameState,
  WorkerInbound,
  WorkerOutbound,
  PlayerAction,
  TickResult,
  ResourcePool,
  BuildingState,
  WorkerState,
} from "./tick-types";
import { BUILDING_CONFIG } from "./building-config";
import { findPath, tileIdToCoord } from "./pathfinder";
import { expandTerritory, MAP_WIDTH } from "./map-generator";

const BASE_TICK_MS = 2000;
const MIN_TICK_MS = 20;
const BASE_STORAGE = 200;
const STOREHOUSE_BONUS = 200;
const WORKER_UPKEEP_FOOD = 1;

/** Knowledge cost to advance eras. Keyed by current era. */
const ERA_THRESHOLDS = { 1: 50, 2: 200 } as const;
/** Worker count gate to advance eras. Keyed by current era. */
const ERA_POPULATION_GATES = { 1: 3, 2: 8 } as const;


let state: GameState | null = null;
let actionQueue: PlayerAction[] = [];
let paused = false;
let tickTimeoutId: ReturnType<typeof setTimeout> | null = null;
let tickMs = BASE_TICK_MS;

function emit(msg: WorkerOutbound) {
  self.postMessage(msg);
}

/** Compute current storage capacity based on placed Storehouses. */
function getStorageCapacity(buildings: BuildingState[]): number {
  const storehouses = buildings.filter(
    (b) => b.type === "STOREHOUSE" && b.constructionTicksRemaining === 0,
  ).length;
  return BASE_STORAGE + storehouses * STOREHOUSE_BONUS;
}

/** Check if any deposit target (Storehouse/Town Hall) has remaining capacity. */
function hasDepositCapacity(
  resources: ResourcePool,
  buildings: BuildingState[],
): boolean {
  const capacity = getStorageCapacity(buildings);
  // If any resource is below capacity, deposits can be accepted
  return (
    resources.food < capacity ||
    resources.wood < capacity ||
    resources.stone < capacity ||
    resources.knowledge < capacity
  );
}

function assignConstructionWorkers() {
  if (!state) return;

  const idleWorkers = [...state.workers]
    .filter((w) => w.state === "IDLE" && w.assignedBuildingId === null)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (idleWorkers.length === 0) return;

  const pendingBuildings = [...state.buildings]
    .filter(
      (b) => b.constructionTicksRemaining > 0 && !b.constructionWorkerId,
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  for (const building of pendingBuildings) {
    const worker = idleWorkers.shift();
    if (!worker) break;

    worker.assignedBuildingId = building.id;
    worker.state = "MOVING_TO_CONSTRUCT";
    worker.path = [];
    building.constructionWorkerId = worker.id;
    recalculatePath(worker);
  }
}

function runTick() {
  if (!state) return;

  const snapshotStart: ResourcePool = { ...state.resources };
  const actionRejections: { action: PlayerAction; reason: string }[] = [];
  let eraChangedThisTick = false;

  // ─── STEP 1 — Drain action queue (FIFO) ───
  const currentActions = [...actionQueue];
  actionQueue = [];

  for (const action of currentActions) {
    const rejection = validateAndApplyAction(action);
    if (rejection) {
      actionRejections.push({ action, reason: rejection });
    }
  }

  // Assign idle workers to construction tasks (deterministic order)
  assignConstructionWorkers();

  // ─── STEP 2 — Evaluate worker state machines ───
  const workers = [...state.workers].sort((a, b) => a.id.localeCompare(b.id));
  const workerDepositDelta: ResourcePool = {
    food: 0,
    wood: 0,
    stone: 0,
    knowledge: 0,
  };

  for (const worker of workers) {
    processWorkerStateMachine(worker, workerDepositDelta);
  }

  // ─── STEP 3 — Production ───
  const productionDelta: ResourcePool = {
    food: 0,
    wood: 0,
    stone: 0,
    knowledge: 0,
  };
  let hasOperationalFoodProducer = false;
  const buildingUpdates: {
    id: string;
    staffed: boolean;
    operational: boolean;
  }[] = [];

  const buildings = [...state.buildings].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (const b of buildings) {
    const config = BUILDING_CONFIG[b.type];
    if (!config) continue;

    const isConstructed = b.constructionTicksRemaining === 0;
    b.staffed = isConstructed
      ? b.assignedWorkerIds.length >= config.requiredWorkers
      : false;
    b.operational = isConstructed && b.staffed;

    if (b.operational && config.resource) {
      productionDelta[config.resource] += config.yieldAmount;
      if (config.resource === "food") {
        hasOperationalFoodProducer = true;
      }
    }
    buildingUpdates.push({
      id: b.id,
      staffed: b.staffed,
      operational: b.operational,
    });
  }

  // ─── STEP 4 — Consumption ───
  const totalUpkeep = hasOperationalFoodProducer
    ? state.workers.length * WORKER_UPKEEP_FOOD
    : 0;
  const netFoodDelta =
    productionDelta.food + workerDepositDelta.food - totalUpkeep;

  if (!hasOperationalFoodProducer) {
    state.workers.forEach((w) => {
      if (w.state === "STARVING") w.state = "IDLE";
    });
  } else if (state.resources.food + netFoodDelta < 0) {
    // Starvation: all workers enter STARVING state
    state.workers.forEach((w) => (w.state = "STARVING"));
  } else {
    // Food is available: recover any STARVING workers
    state.workers.forEach((w) => {
      if (w.state === "STARVING") w.state = "IDLE";
    });
  }

  // ─── STEP 5 — Commit delta to ResourcePool ───
  const capacity = getStorageCapacity(state.buildings);

  const combinedDelta: ResourcePool = {
    food: productionDelta.food + workerDepositDelta.food - totalUpkeep,
    wood: productionDelta.wood + workerDepositDelta.wood,
    stone: productionDelta.stone + workerDepositDelta.stone,
    knowledge: productionDelta.knowledge + workerDepositDelta.knowledge,
  };

  const resourceKeys: (keyof ResourcePool)[] = [
    "food",
    "wood",
    "stone",
    "knowledge",
  ];
  for (const key of resourceKeys) {
    state.resources[key] = Math.min(
      Math.max(0, state.resources[key] + combinedDelta[key]),
      capacity,
    );
  }

  // ─── STEP 6 — Era progression (PRD: action-driven via RESEARCH_ERA) ───
  // Era advancement is player-initiated through the RESEARCH_ERA action
  // processed in Step 1. This step is reserved for future passive triggers.

  // ─── STEP 7 — Compute TickResult delta & emit ───
  state.tickCount++;

  const resourceDelta: ResourcePool = {
    food: state.resources.food - snapshotStart.food,
    wood: state.resources.wood - snapshotStart.wood,
    stone: state.resources.stone - snapshotStart.stone,
    knowledge: state.resources.knowledge - snapshotStart.knowledge,
  };

  const tickResult: TickResult = {
    type: "TICK_RESULT",
    tickCount: state.tickCount,
    resourceTotals: { ...state.resources },
    resourceDelta,
    workerPositions: state.workers.map((w) => ({
      id: w.id,
      tileId: w.position.y * MAP_WIDTH + w.position.x,
      state: w.state,
    })),
    buildingUpdates,
    eraChanged: eraChangedThisTick,
    newEra: state.era,
    actionRejections,
    // Full state sync for UI rendering
    workers: state.workers.map((w) => ({ ...w, path: [...w.path] })),
    buildings: state.buildings.map((b) => ({
      ...b,
      assignedWorkerIds: [...b.assignedWorkerIds],
    })),
    tiles: state.tiles,
  };

  emit(tickResult);
}

function validateAndApplyAction(action: PlayerAction): string | null {
  if (!state) return "NO_STATE";

  switch (action.type) {
    case "PLACE_BUILDING": {
      const tile = state.tiles[action.tileId];
      if (!tile) return "TILE_NOT_FOUND";
      if (!tile.owned || !tile.walkable || tile.buildingId)
        return "TILE_INVALID";

      const config = BUILDING_CONFIG[action.buildingType];
      if (!config) return "UNKNOWN_BUILDING_TYPE";
      if (state.era < config.requiredEra) return "ERA_LOCKED";
      if (
        action.buildingType === "TOWN_HALL" &&
        state.buildings.some((b) => b.type === "TOWN_HALL")
      ) {
        return "TOWN_HALL_EXISTS";
      }

      // Adjacency Validation
      if (
        action.buildingType === "FORAGER_HUT" ||
        action.buildingType === "LUMBER_MILL" ||
        action.buildingType === "QUARRY"
      ) {
        const cx = action.tileId % MAP_WIDTH;
        const cy = Math.floor(action.tileId / MAP_WIDTH);
        let hasRequiredAdjacency = false;

        const targetBiome =
          action.buildingType === "FORAGER_HUT"
            ? "GRASSLAND"
            : action.buildingType === "LUMBER_MILL"
              ? "FOREST"
              : "STONE_DEPOSIT";

        // Check N, S, E, W
        const neighbors = [
          { x: cx, y: cy - 1 },
          { x: cx, y: cy + 1 },
          { x: cx - 1, y: cy },
          { x: cx + 1, y: cy },
        ];

        for (const n of neighbors) {
          if (n.x >= 0 && n.x < MAP_WIDTH && n.y >= 0 && n.y < MAP_WIDTH) {
            const nId = n.y * MAP_WIDTH + n.x;
            if (state.tiles[nId]?.type === targetBiome) {
              hasRequiredAdjacency = true;
              break;
            }
          }
        }

        if (!hasRequiredAdjacency) return "MISSING_ADJACENT_BIOME";
      }

      // Check costs
      const cost = config.cost;
      for (const r of Object.keys(cost) as (keyof ResourcePool)[]) {
        if (state.resources[r] < (cost[r] || 0))
          return "INSUFFICIENT_RESOURCES";
      }

      // Deduct costs
      for (const r of Object.keys(cost) as (keyof ResourcePool)[]) {
        state.resources[r] -= cost[r] || 0;
      }

      const building: BuildingState = {
        id: `b-${state.tickCount}-${action.tileId}`,
        type: action.buildingType,
        tileId: action.tileId,
        tier: 1,
        constructionTicksRemaining: config.constructionTicks,
        constructionWorkerId: null,
        staffed: false,
        operational: false,
        assignedWorkerIds: [],
      };
      state.buildings.push(building);
      tile.buildingId = building.id;
      tile.walkable = false;

      // Expand territory around the new building
      expandTerritory(state.tiles, action.tileId, 3, 5);

      // Invalidate worker paths that cross this tile
      state.workers.forEach((w) => {
        if (
          w.path.some(
            (coord) => coord.y * MAP_WIDTH + coord.x === action.tileId,
          )
        ) {
          w.path = [];
        }
      });

      // PRD: First TOWN_HALL placement spawns 3 workers
      if (action.buildingType === "TOWN_HALL" && state.workers.length === 0) {
        const coord = tileIdToCoord(action.tileId);
        for (let i = 0; i < 3; i++) {
          state.workers.push({
            id: `w-${state.tickCount}-${i}`,
            state: "IDLE",
            assignedBuildingId: null,
            position: { ...coord },
            path: [],
            harvestTicks: 0,
            carrying: null,
          });
        }
        // Give starting food to prevent immediate starvation
        state.resources.food = 20;
      }
      return null;
    }

    case "DEMOLISH_BUILDING": {
      const bIndex = state.buildings.findIndex(
        (b) => b.id === action.buildingId,
      );
      if (bIndex === -1) return "BUILDING_NOT_FOUND";
      const b = state.buildings[bIndex];
      if (b.type === "TOWN_HALL") return "CANNOT_DEMOLISH_TOWN_HALL";

      // Unassign all workers from this building
      b.assignedWorkerIds.forEach((id) => {
        const w = state!.workers.find((worker) => worker.id === id);
        if (w) {
          w.assignedBuildingId = null;
          w.state = "IDLE";
          w.path = [];
          w.carrying = null;
          w.harvestTicks = 0;
        }
      });
      // Release any construction worker assigned to this building
      state.workers.forEach((w) => {
        if (w.assignedBuildingId === b.id) {
          w.assignedBuildingId = null;
          w.state = "IDLE";
          w.path = [];
          w.carrying = null;
          w.harvestTicks = 0;
        }
      });

      const tile = state.tiles[b.tileId];
      tile.buildingId = null;
      tile.walkable = true;

      // Invalidate paths crossing the demolished building's tile
      state.workers.forEach((w) => {
        if (
          w.path.some((coord) => coord.y * MAP_WIDTH + coord.x === b.tileId)
        ) {
          w.path = [];
        }
      });

      state.buildings.splice(bIndex, 1);
      return null;
    }

    case "ASSIGN_WORKER": {
      const w = state.workers.find((worker) => worker.id === action.workerId);
      const b = state.buildings.find(
        (building) => building.id === action.buildingId,
      );
      if (!w || !b) return "INVALID_TARGETS";
      if (w.assignedBuildingId !== null) return "WORKER_ALREADY_ASSIGNED";
      if (b.constructionTicksRemaining > 0)
        return "BUILDING_UNDER_CONSTRUCTION";

      // Check if building is fully staffed
      const config = BUILDING_CONFIG[b.type];
      if (!config || config.requiredWorkers === 0 || !config.resource) {
        return "BUILDING_NOT_ASSIGNABLE";
      }
      if (
        config &&
        config.requiredWorkers > 0 &&
        b.assignedWorkerIds.length >= config.requiredWorkers
      ) {
        return "BUILDING_FULLY_STAFFED";
      }

      w.assignedBuildingId = b.id;
      b.assignedWorkerIds.push(w.id);
      w.state = "IDLE"; // Will transition to MOVING_TO_HARVEST on next worker eval
      w.path = [];
      return null;
    }

    case "UNASSIGN_WORKER": {
      const w = state.workers.find((worker) => worker.id === action.workerId);
      if (!w || w.assignedBuildingId === null) return "NOT_ASSIGNED";

      const b = state.buildings.find(
        (building) => building.id === w.assignedBuildingId,
      );
      if (b) {
        b.assignedWorkerIds = b.assignedWorkerIds.filter((id) => id !== w.id);
      }

      w.assignedBuildingId = null;
      w.state = "IDLE";
      w.path = [];
      w.carrying = null;
      w.harvestTicks = 0;
      return null;
    }

    case "RESEARCH_ERA": {
      if (state.era !== action.targetEra - 1) return "INVALID_ERA_ORDER";
      const threshold =
        ERA_THRESHOLDS[state.era as keyof typeof ERA_THRESHOLDS];
      const popGate =
        ERA_POPULATION_GATES[state.era as keyof typeof ERA_POPULATION_GATES];

      if (!threshold || !popGate) return "INVALID_ERA_ORDER";
      if (state.resources.knowledge < threshold)
        return "INSUFFICIENT_KNOWLEDGE";
      if (state.workers.length < popGate) return "INSUFFICIENT_POPULATION";

      state.resources.knowledge -= threshold;
      state.era = action.targetEra;
      return null;
    }

    case "SPAWN_WORKER": {
      if (state.resources.food < 50) return "INSUFFICIENT_FOOD";
      
      const townHall = state.buildings.find((b) => b.type === "TOWN_HALL");
      if (!townHall) return "TOWN_HALL_MISSING";

      state.resources.food -= 50;
      
      const coord = tileIdToCoord(townHall.tileId);
      state.workers.push({
        id: `w-${state.tickCount}-${state.workers.length}`,
        state: "IDLE",
        assignedBuildingId: null,
        position: { ...coord },
        path: [],
        harvestTicks: 0,
        carrying: null,
      });
      
      return null;
    }

    default:
      return "UNKNOWN_ACTION";
  }
}

function processWorkerStateMachine(
  worker: WorkerState,
  depositDelta: ResourcePool,
) {
  if (worker.state === "STARVING") return;

  switch (worker.state) {
    case "IDLE":
      if (worker.assignedBuildingId) {
        const targetBuilding = state!.buildings.find(
          (building) => building.id === worker.assignedBuildingId,
        );
        if (!targetBuilding) {
          worker.assignedBuildingId = null;
          return;
        }
        if (targetBuilding.constructionTicksRemaining > 0) {
          worker.state = "MOVING_TO_CONSTRUCT";
        } else {
          worker.state = "MOVING_TO_HARVEST";
        }
        recalculatePath(worker);
      }
      break;

    case "MOVING_TO_CONSTRUCT":
      if (worker.path.length > 0) {
        const next = worker.path.shift()!;
        worker.position = next;
        if (worker.path.length === 0) {
          worker.state = "CONSTRUCTING";
        }
      } else {
        const targetBuilding = state!.buildings.find(
          (building) => building.id === worker.assignedBuildingId,
        );
        if (!targetBuilding) {
          worker.state = "IDLE";
          worker.assignedBuildingId = null;
          return;
        }
        const targetCoord = tileIdToCoord(targetBuilding.tileId);
        if (
          worker.position.x === targetCoord.x &&
          worker.position.y === targetCoord.y
        ) {
          worker.state = "CONSTRUCTING";
        } else {
          targetBuilding.constructionWorkerId = null;
          worker.state = "IDLE";
          worker.assignedBuildingId = null;
        }
      }
      break;

    case "CONSTRUCTING": {
      const b = state!.buildings.find(
        (building) => building.id === worker.assignedBuildingId,
      );
      if (!b) {
        worker.state = "IDLE";
        worker.assignedBuildingId = null;
        return;
      }
      if (b.constructionTicksRemaining > 0) {
        b.constructionTicksRemaining = Math.max(
          0,
          b.constructionTicksRemaining - 1,
        );
      }
      if (b.constructionTicksRemaining === 0) {
        b.constructionWorkerId = null;
        worker.state = "IDLE";
        worker.assignedBuildingId = null;
        worker.path = [];
        worker.carrying = null;
        worker.harvestTicks = 0;
      }
      break;
    }

    case "MOVING_TO_HARVEST":
      if (worker.path.length > 0) {
        const next = worker.path.shift()!;
        worker.position = next;
        if (worker.path.length === 0) {
          worker.state = "HARVESTING";
        }
      } else {
        // Path was empty — either arrived or couldn't pathfind
        worker.state = "HARVESTING";
      }
      break;

    case "HARVESTING": {
      const b = state!.buildings.find(
        (building) => building.id === worker.assignedBuildingId,
      );
      if (!b) {
        worker.state = "IDLE";
        worker.assignedBuildingId = null;
        return;
      }
      if (b.constructionTicksRemaining > 0) {
        worker.state = "IDLE";
        worker.assignedBuildingId = null;
        return;
      }
      const config = BUILDING_CONFIG[b.type];
      if (!config || !config.resource) {
        worker.state = "IDLE";
        return;
      }

      worker.harvestTicks++;
      if (worker.harvestTicks >= config.ticksToHarvest) {
        worker.carrying = {
          type: config.resource,
          amount: config.yieldAmount,
        };
        worker.harvestTicks = 0;

        // Check if there's capacity before trying to deposit
        if (hasDepositCapacity(state!.resources, state!.buildings)) {
          worker.state = "MOVING_TO_DEPOSIT";
          recalculatePath(worker);
        } else {
          worker.state = "WAITING";
        }
      }
      break;
    }

    case "MOVING_TO_DEPOSIT":
      if (worker.path.length > 0) {
        const next = worker.path.shift()!;
        worker.position = next;
        if (worker.path.length === 0) {
          worker.state = "DEPOSITING";
        }
      } else {
        // Check capacity on arrival
        if (hasDepositCapacity(state!.resources, state!.buildings)) {
          worker.state = "DEPOSITING";
        } else {
          worker.state = "WAITING";
        }
      }
      break;

    case "DEPOSITING":
      if (worker.carrying) {
        const type = worker.carrying.type;
        depositDelta[type] += worker.carrying.amount;
        worker.carrying = null;
      }
      worker.state = "MOVING_TO_HARVEST";
      recalculatePath(worker);
      break;

    case "WAITING":
      // Re-check storage capacity each tick
      if (hasDepositCapacity(state!.resources, state!.buildings)) {
        worker.state = "MOVING_TO_DEPOSIT";
        recalculatePath(worker);
      }
      break;
  }
}

function recalculatePath(worker: WorkerState) {
  if (!state) return;

  let targetId: number | null = null;
  if (
    worker.state === "MOVING_TO_HARVEST" ||
    worker.state === "HARVESTING" ||
    worker.state === "MOVING_TO_CONSTRUCT" ||
    worker.state === "CONSTRUCTING"
  ) {
    const b = state.buildings.find(
      (building) => building.id === worker.assignedBuildingId,
    );
    if (b) targetId = b.tileId;
  } else if (
    worker.state === "MOVING_TO_DEPOSIT" ||
    worker.state === "DEPOSITING"
  ) {
    // Find closest Storehouse or Town Hall for deposit
    const dropoffs = state.buildings.filter(
      (b) =>
        (b.type === "STOREHOUSE" || b.type === "TOWN_HALL") &&
        b.constructionTicksRemaining === 0,
    );
    let minDist = Infinity;
    for (const d of dropoffs) {
      const coord = tileIdToCoord(d.tileId);
      const dist =
        Math.abs(worker.position.x - coord.x) +
        Math.abs(worker.position.y - coord.y);
      if (dist < minDist) {
        minDist = dist;
        targetId = d.tileId;
      }
    }
  }

  if (targetId !== null) {
    const targetCoord = tileIdToCoord(targetId);
    worker.path = findPath(worker.position, targetCoord, state.tiles);
    if (
      worker.path.length === 0 &&
      (worker.position.x !== targetCoord.x ||
        worker.position.y !== targetCoord.y)
    ) {
      // No path found and not already at target
      worker.state = "IDLE";
    }
  } else {
    worker.state = "IDLE";
  }
}

function scheduleTick() {
  if (paused) return;
  tickTimeoutId = setTimeout(() => {
    runTick();
    scheduleTick();
  }, tickMs);
}

function setSpeed(multiplier: number) {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return;
  const clamped = Math.max(1, Math.min(100, multiplier));
  tickMs = Math.max(MIN_TICK_MS, Math.floor(BASE_TICK_MS / clamped));
  if (!paused) {
    if (tickTimeoutId) clearTimeout(tickTimeoutId);
    scheduleTick();
  }
}

self.addEventListener("message", (e: MessageEvent<WorkerInbound>) => {
  const msg = e.data;
  switch (msg.type) {
    case "INIT":
      state = msg.state;
      // Ensure all initial tiles have IDs
      state.tiles.forEach((t, i) => (t.id = i));
      emit({ type: "READY" });
      scheduleTick();
      break;

    case "PLAYER_ACTION":
      actionQueue.push(msg.action);
      break;

    case "PAUSE":
      paused = true;
      if (tickTimeoutId) clearTimeout(tickTimeoutId);
      break;

    case "RESUME":
      paused = false;
      scheduleTick();
      break;
    case "SET_SPEED":
      setSpeed(msg.multiplier);
      break;
  }
});

