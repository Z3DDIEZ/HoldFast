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
import { findPath, tileIdToCoord } from "./pathfinder";

const MAP_WIDTH = 80;
const TICK_MS = 2000;
const BASE_STORAGE = 200;
const STOREHOUSE_BONUS = 200;
const WORKER_UPKEEP_FOOD = 1;

const ERA_THRESHOLDS = { 1: 50, 2: 200 } as const;
const ERA_POPULATION_GATES = { 1: 3, 2: 8 } as const;

const BUILDING_CONFIG = {
  TOWN_HALL: {
    resource: null,
    ticksToHarvest: 0,
    yieldAmount: 0,
    requiredWorkers: 0,
    requiredEra: 1,
    cost: {},
  },
  FORAGER_HUT: {
    resource: "food",
    ticksToHarvest: 3,
    yieldAmount: 1,
    requiredWorkers: 1,
    requiredEra: 1,
    cost: { wood: 10 },
  },
  LUMBER_MILL: {
    resource: "wood",
    ticksToHarvest: 3,
    yieldAmount: 1,
    requiredWorkers: 1,
    requiredEra: 1,
    cost: { wood: 5, stone: 5 },
  },
  QUARRY: {
    resource: "stone",
    ticksToHarvest: 4,
    yieldAmount: 1,
    requiredWorkers: 1,
    requiredEra: 1,
    cost: { wood: 8 },
  },
  STOREHOUSE: {
    resource: null,
    ticksToHarvest: 0,
    yieldAmount: 0,
    requiredWorkers: 0,
    requiredEra: 1,
    cost: { wood: 15, stone: 5 },
  },
  FARM: {
    resource: "food",
    ticksToHarvest: 2,
    yieldAmount: 2,
    requiredWorkers: 2,
    requiredEra: 2,
    cost: { wood: 20, stone: 10 },
  },
  LIBRARY: {
    resource: "knowledge",
    ticksToHarvest: 5,
    yieldAmount: 1,
    requiredWorkers: 1,
    requiredEra: 2,
    cost: { wood: 25, stone: 20 },
  },
  BARRACKS: {
    resource: null,
    ticksToHarvest: 0,
    yieldAmount: 0,
    requiredWorkers: 0,
    requiredEra: 3,
    cost: { wood: 30, stone: 30 },
  },
} as const;

let state: GameState | null = null;
let actionQueue: PlayerAction[] = [];
let paused = false;
let tickTimeoutId: ReturnType<typeof setTimeout> | null = null;

function emit(msg: WorkerOutbound) {
  self.postMessage(msg);
}

function runTick() {
  if (!state) return;

  const snapshotStart = JSON.parse(
    JSON.stringify(state.resources),
  ) as ResourcePool;
  const actionRejections: { action: PlayerAction; reason: string }[] = [];
  let eraChangedThisTick = false;

  // STEP 1 — Drain action queue (FIFO)
  const currentActions = [...actionQueue];
  actionQueue = [];

  for (const action of currentActions) {
    const rejection = validateAndApplyAction(action);
    if (rejection) {
      actionRejections.push({ action, reason: rejection });
    }
  }

  // STEP 2 — Evaluate worker state machines
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

  // STEP 3 — Production
  const productionDelta: ResourcePool = {
    food: 0,
    wood: 0,
    stone: 0,
    knowledge: 0,
  };
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
    b.staffed = b.assignedWorkerIds.length >= config.requiredWorkers;
    b.operational = b.staffed; // MVP rule

    if (b.staffed && b.operational && config.resource) {
      productionDelta[config.resource] += config.yieldAmount;
    }
    buildingUpdates.push({
      id: b.id,
      staffed: b.staffed,
      operational: b.operational,
    });
  }

  // STEP 4 — Consumption
  const totalUpkeep = state.workers.length * WORKER_UPKEEP_FOOD;
  const netFoodDelta =
    productionDelta.food + workerDepositDelta.food - totalUpkeep;

  if (state.resources.food + netFoodDelta < 0) {
    state.workers.forEach((w) => (w.state = "STARVING"));
  } else {
    // If food will be positive, transition STARVING workers back to IDLE
    state.workers.forEach((w) => {
      if (w.state === "STARVING") w.state = "IDLE";
    });
  }

  // STEP 5 — Commit delta
  const storehouseCount = state.buildings.filter(
    (b) => b.type === "STOREHOUSE",
  ).length;
  const capacity = BASE_STORAGE + storehouseCount * STOREHOUSE_BONUS;

  const combinedDelta: ResourcePool = {
    food: productionDelta.food + workerDepositDelta.food - totalUpkeep,
    wood: productionDelta.wood + workerDepositDelta.wood,
    stone: productionDelta.stone + workerDepositDelta.stone,
    knowledge: productionDelta.knowledge + workerDepositDelta.knowledge,
  };

  for (const r in state.resources) {
    const key = r as keyof ResourcePool;
    state.resources[key] = Math.min(
      Math.max(0, state.resources[key] + combinedDelta[key]),
      capacity,
    );
  }

  // STEP 6 — Era progression handled in Step 1

  // STEP 7 — Emit TickResult
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
      if (state.era < config.requiredEra) return "ERA_LOCKED";

      // Check costs
      const cost = config.cost as Partial<ResourcePool>;
      for (const r in cost) {
        const key = r as keyof ResourcePool;
        if (state.resources[key] < (cost[key] || 0))
          return "INSUFFICIENT_RESOURCES";
      }

      // Apply
      for (const r in cost) {
        const key = r as keyof ResourcePool;
        state.resources[key] -= cost[key] || 0;
      }

      const building: BuildingState = {
        id: `b-${state.tickCount}-${action.tileId}`,
        type: action.buildingType,
        tileId: action.tileId,
        tier: 1,
        staffed: false,
        operational: false,
        assignedWorkerIds: [],
      };
      state.buildings.push(building);
      tile.buildingId = building.id;
      tile.walkable = false;
      return null;
    }

    case "DEMOLISH_BUILDING": {
      const bIndex = state.buildings.findIndex(
        (b) => b.id === action.buildingId,
      );
      if (bIndex === -1) return "BUILDING_NOT_FOUND";
      const b = state.buildings[bIndex];
      if (b.type === "TOWN_HALL") return "CANNOT_DEMOLISH_TOWN_HALL";

      // Unassign workers
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

      const tile = state.tiles[b.tileId];
      tile.buildingId = null;
      tile.walkable = true;

      // Invalidate paths
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
      if (!b.operational) return "BUILDING_NOT_OPERATIONAL";
      if (w.assignedBuildingId !== null) return "WORKER_ALREADY_ASSIGNED";

      w.assignedBuildingId = b.id;
      b.assignedWorkerIds.push(w.id);
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

      if (state.resources.knowledge < threshold)
        return "INSUFFICIENT_KNOWLEDGE";
      if (state.workers.length < popGate) return "INSUFFICIENT_POPULATION";

      state.resources.knowledge -= threshold;
      state.era = action.targetEra;
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

  const transition = () => {
    switch (worker.state) {
      case "IDLE":
        if (worker.assignedBuildingId) {
          worker.state = "MOVING_TO_HARVEST";
          recalculatePath(worker);
        }
        break;

      case "MOVING_TO_HARVEST":
      case "MOVING_TO_DEPOSIT":
        if (worker.path.length > 0) {
          const next = worker.path.shift()!;
          worker.position = next;
          if (worker.path.length === 0) {
            worker.state =
              worker.state === "MOVING_TO_HARVEST"
                ? "HARVESTING"
                : "DEPOSITING";
          }
        } else {
          // Arrived or stuck
          worker.state =
            worker.state === "MOVING_TO_HARVEST" ? "HARVESTING" : "DEPOSITING";
          // Force a final position check if path was empty
        }
        break;

      case "HARVESTING": {
        const b = state!.buildings.find(
          (building) => building.id === worker.assignedBuildingId,
        );
        if (!b || !b.operational) {
          worker.state = "IDLE";
          return;
        }
        const config = BUILDING_CONFIG[b.type];
        if (!config.resource) {
          worker.state = "IDLE";
          return;
        }

        worker.harvestTicks++;
        if (worker.harvestTicks >= config.ticksToHarvest) {
          worker.carrying = {
            type: config.resource as any,
            amount: config.yieldAmount,
          };
          worker.harvestTicks = 0;
          worker.state = "MOVING_TO_DEPOSIT";
          recalculatePath(worker);
        }
        break;
      }

      case "DEPOSITING":
        if (worker.carrying) {
          const type = worker.carrying.type as keyof ResourcePool;
          depositDelta[type] += worker.carrying.amount;
          worker.carrying = null;
        }
        worker.state = "MOVING_TO_HARVEST";
        recalculatePath(worker);
        break;
    }
  };

  transition();
}

function recalculatePath(worker: WorkerState) {
  if (!state) return;

  let targetId: number | null = null;
  if (worker.state === "MOVING_TO_HARVEST" || worker.state === "HARVESTING") {
    const b = state.buildings.find(
      (building) => building.id === worker.assignedBuildingId,
    );
    if (b) targetId = b.tileId;
  } else if (
    worker.state === "MOVING_TO_DEPOSIT" ||
    worker.state === "DEPOSITING"
  ) {
    // For DEPOSIT, find closest STOREHOUSE or TOWN_HALL
    const dropoffs = state.buildings.filter(
      (b) => b.type === "STOREHOUSE" || b.type === "TOWN_HALL",
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
  }, TICK_MS);
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
  }
});
