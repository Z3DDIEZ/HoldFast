// NO Math.random() — simulation must be deterministic

import type {
  GameState,
  WorkerInbound,
  WorkerOutbound,
  PlayerAction,
  TickResult,
  ResourcePool,
  BuildingState,
  BuildingType,
  TileCoordinate,
  UnitState,
  TileState,
  WorkerState,
  Civilization,
} from "./tick-types";
import { BUILDING_CONFIG, UNIT_CONFIG } from "./building-config";
import { getCivilization } from "./civilizations";
import { findPath, tileIdToCoord } from "./pathfinder";
import { expandTerritory, MAP_WIDTH } from "./map-generator";

const BASE_TICK_MS = 2000;
const MIN_TICK_MS = 20;
const BASE_STORAGE = 200;
const STOREHOUSE_BONUS = 200;
const HOUSING_CAPACITY: Partial<Record<BuildingType, number>> = {
  TOWN_HALL: 3,
  STOREHOUSE: 2,
  BARRACKS: 4,
};

/** Knowledge cost to advance eras. Keyed by current era. */
const ERA_THRESHOLDS = { 1: 50, 2: 200, 3: 1000 } as const;
/** Worker count gate to advance eras. Keyed by current era. */
const ERA_POPULATION_GATES = { 1: 3, 2: 8, 3: 20 } as const;
/** Target building counts per Era. */
const ERA_BUILDING_GOALS: Record<number, Partial<Record<BuildingType, number>>> = {
  1: { FORAGER_HUT: 1, LUMBER_MILL: 1, QUARRY: 1, LIBRARY: 1, STOREHOUSE: 1 },
  2: { FARM: 2, LUMBER_MILL: 2, QUARRY: 2, LIBRARY: 1, STOREHOUSE: 2 },
  3: { FARM: 3, LUMBER_MILL: 3, QUARRY: 3, LIBRARY: 2, STOREHOUSE: 4, BARRACKS: 1 },
  4: { FARM: 5, LUMBER_MILL: 4, QUARRY: 4, LIBRARY: 3, STOREHOUSE: 6, BARRACKS: 2 },
};



let state: GameState | null = null;
let civilization: Civilization | null = null;
let actionQueue: PlayerAction[] = [];
let paused = false;
let tickTimeoutId: ReturnType<typeof setTimeout> | null = null;
let tickMs = BASE_TICK_MS;
let eraChangedThisTick = false;

/** Update visibility for all tiles within a unit's vision radius. */
function updateVision(unit: UnitState, tiles: TileState[]) {
  const visionBoost = civilization?.bonuses.visionRadiusBoost || 0;
  const radius = unit.visionRadius + visionBoost;
  const cx = unit.position.x;
  const cy = unit.position.y;

  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -radius; dy <= radius; dy++) {
      // Euclidean distance check for circular vision
      if (dx * dx + dy * dy <= radius * radius) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_WIDTH) {
          const nId = ny * MAP_WIDTH + nx;
          if (tiles[nId]) {
            tiles[nId].visible = true;
          }
        }
      }
    }
  }
}

function emit(msg: WorkerOutbound) {
  if (typeof self !== "undefined" && "postMessage" in self) {
    self.postMessage(msg);
  }
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

/** Compute total housing capacity based on constructed buildings. */
function getHousingCapacity(buildings: BuildingState[]): number {
  return buildings.reduce((total, building) => {
    if (building.constructionTicksRemaining > 0) return total;
    return total + (HOUSING_CAPACITY[building.type] ?? 0);
  }, 0);
}

function isAtTile(worker: WorkerState, tileId: number): boolean {
  const x = tileId % MAP_WIDTH;
  const y = Math.floor(tileId / MAP_WIDTH);
  return worker.position.x === x && worker.position.y === y;
}

function getNearestDropoffTileId(position: TileCoordinate): number | null {
  if (!state) return null;

  const dropoffs = state.buildings
    .filter(
      (b) =>
        (b.type === "STOREHOUSE" || b.type === "TOWN_HALL") &&
        b.constructionTicksRemaining === 0,
    )
    .sort((a, b) => a.tileId - b.tileId);

  let bestId: number | null = null;
  let bestDist = Infinity;

  for (const dropoff of dropoffs) {
    const coord = tileIdToCoord(dropoff.tileId);
    const dist =
      Math.abs(position.x - coord.x) + Math.abs(position.y - coord.y);
    if (
      dist < bestDist ||
      (dist === bestDist && (bestId === null || dropoff.tileId < bestId))
    ) {
      bestDist = dist;
      bestId = dropoff.tileId;
    }
  }

  return bestId;
}

function getWorkerTargetTileId(worker: WorkerState): number | null {
  if (!state) return null;

  if (
    worker.state === "MOVING_TO_HARVEST" ||
    worker.state === "HARVESTING" ||
    worker.state === "MOVING_TO_CONSTRUCT" ||
    worker.state === "CONSTRUCTING"
  ) {
    const building = state.buildings.find(
      (b) => b.id === worker.assignedBuildingId,
    );
    return building ? building.tileId : null;
  }

  if (
    worker.state === "MOVING_TO_DEPOSIT" ||
    worker.state === "DEPOSITING" ||
    worker.state === "WAITING"
  ) {
    return getNearestDropoffTileId(worker.position);
  }

  return null;
}

function syncBuildingAssignments(): void {
  if (!state) return;

  const assignments = new Map<string, string[]>();
  for (const worker of state.workers) {
    if (!worker.assignedBuildingId) continue;
    const list = assignments.get(worker.assignedBuildingId) ?? [];
    list.push(worker.id);
    assignments.set(worker.assignedBuildingId, list);
  }

  for (const building of state.buildings) {
    const assigned = assignments.get(building.id) ?? [];
    assigned.sort((a, b) => a.localeCompare(b));
    building.assignedWorkerIds = assigned;
  }
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

  // Cap construction workers to 25% of population (min 1, max 5) to prevent stalling economy
  const currentlyBuilding = state.workers.filter(w => w.state === "MOVING_TO_CONSTRUCT" || w.state === "CONSTRUCTING").length;
  const constructionCap = Math.max(1, Math.min(5, Math.floor(state.workers.length * 0.25)));
  
  if (currentlyBuilding >= constructionCap) return;
  let assignmentsMade = 0;

  for (const building of pendingBuildings) {
    if (currentlyBuilding + assignmentsMade >= constructionCap) break;
    const worker = idleWorkers.shift();
    if (!worker) break;

    worker.assignedBuildingId = building.id;
    worker.state = "MOVING_TO_CONSTRUCT";
    worker.path = [];
    building.constructionWorkerId = worker.id;
    const pathFound = recalculatePath(worker);
    if (!pathFound) {
      worker.assignedBuildingId = null;
      worker.state = "IDLE";
      worker.path = [];
      building.constructionWorkerId = null;
    } else {
      assignmentsMade++;
    }
  }
}

function runTick() {
  if (!state) return;

  syncBuildingAssignments();

  const snapshotStart: ResourcePool = { ...state.resources };
  const actionRejections: { action: PlayerAction; reason: string }[] = [];
  eraChangedThisTick = false;

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

  // If Auto-Play is enabled, perform autonomous actions
  if (state.autoPlay) {
    runAutoPlay();
  }

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
    updateVision(worker, state!.tiles);
  }

  syncBuildingAssignments();

  // ─── STEP 3 — Production ───
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
    if (!config) continue;

    const isConstructed = b.constructionTicksRemaining === 0;
    b.staffed = isConstructed
      ? b.assignedWorkerIds.length >= config.requiredWorkers
      : false;
    b.operational = isConstructed && b.staffed;

    if (b.operational && config.resource) {
      const yieldBoost = civilization?.bonuses.yieldMultiplier?.[config.resource] || 1;
      productionDelta[config.resource] += config.yieldAmount * yieldBoost;
    }
    buildingUpdates.push({
      id: b.id,
      staffed: b.staffed,
      operational: b.operational,
    });
  }

  // ─── STEP 4 — Consumption ───
  // 6. Food Upkeep & Starvation
  const foodUpkeep = state.workers.length;
  // Grace period check: No upkeep until an operational food producer exists
  const hasFoodProducer = state.buildings.some(b => 
    (b.type === "FORAGER_HUT" || b.type === "FARM") && b.operational
  );

  if (hasFoodProducer) {
    state.resources.food -= foodUpkeep;
  }

  if (state.resources.food < 0) {
    state.resources.food = 0;
    // Instead of total freeze, mark them for slowdown in state machine
    state.workers.forEach((w) => {
      w.state = "STARVING";
    });
  } else if (state.resources.food > 0 || !hasFoodProducer) {
    // Auto-recover from starvation if food is available or grace period is active
    state.workers.forEach((w) => {
      if (w.state === "STARVING") w.state = "IDLE";
    });
  }

  // ─── STEP 5 — Commit delta to ResourcePool ───
  const capacity = getStorageCapacity(state.buildings);

  const combinedDelta: ResourcePool = {
    food: productionDelta.food + workerDepositDelta.food, // Food upkeep already applied
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
    state.resources[key] = Math.round(
      Math.min(
        Math.max(0, state.resources[key] + combinedDelta[key]),
        capacity,
      )
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

        // Check current tile and Moore neighborhood within radius 2
        for (let dx = -2; dx <= 2; dx++) {
          for (let dy = -2; dy <= 2; dy++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_WIDTH) {
              const nId = ny * MAP_WIDTH + nx;
              if (state.tiles[nId]?.type === targetBiome) {
                hasRequiredAdjacency = true;
                break;
              }
            }
          }
          if (hasRequiredAdjacency) break;
        }

        if (!hasRequiredAdjacency) return "MISSING_ADJACENT_BIOME";
      }

      // Check costs
      const cost = config.cost;
      const costMultiplier = civilization?.bonuses.costMultiplier || {};
      for (const r of Object.keys(cost) as (keyof ResourcePool)[]) {
        const actualCost = (cost[r] || 0) * (costMultiplier[r] || 1);
        if (state.resources[r] < actualCost)
          return "INSUFFICIENT_RESOURCES";
      }

      // Deduct costs
      for (const r of Object.keys(cost) as (keyof ResourcePool)[]) {
        const actualCost = (cost[r] || 0) * (costMultiplier[r] || 1);
        state.resources[r] -= actualCost;
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
          const config = UNIT_CONFIG.WORKER;
          state.workers.push({
            id: `w-${state.tickCount}-${i}`,
            unitType: "WORKER",
            state: "IDLE",
            assignedBuildingId: null,
            position: { ...coord },
            path: [],
            harvestTicks: 0,
            carrying: null,
            visionRadius: config.visionRadius,
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
      const housingLoss =
        b.constructionTicksRemaining === 0 ? (HOUSING_CAPACITY[b.type] ?? 0) : 0;
      if (housingLoss > 0) {
        const capacityAfter = getHousingCapacity(state.buildings) - housingLoss;
        if (state.workers.length > capacityAfter) {
          return "HOUSING_WOULD_BE_EXCEEDED";
        }
      }

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

      const config = BUILDING_CONFIG[b.type];
      if (b.constructionTicksRemaining === 0) {
        // If constructed, check if it's actually assignable for harvesting
        if (!config || config.requiredWorkers === 0 || !config.resource) {
          return "BUILDING_NOT_ASSIGNABLE";
        }
        if (b.assignedWorkerIds.length >= config.requiredWorkers) {
          return "BUILDING_FULLY_STAFFED";
        }
      } else {
        // If under construction, only one worker can build at a time
        if (b.assignedWorkerIds.length >= 1) {
          return "BUILDING_ALREADY_BEING_BUILT";
        }
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
      eraChangedThisTick = true;
      return null;
    }

    case "SPAWN_WORKER": {
      // Keep for backward compatibility, delegate to SPAWN_UNIT
      const townHall = state.buildings.find((b) => b.type === "TOWN_HALL");
      if (!townHall) return "TOWN_HALL_MISSING";
      return validateAndApplyAction({ 
        type: "SPAWN_UNIT", 
        unitType: "WORKER", 
        buildingId: townHall.id 
      });
    }

    case "SPAWN_UNIT": {
      const b = state.buildings.find(building => building.id === action.buildingId);
      if (!b) return "BUILDING_NOT_FOUND";
      if (b.constructionTicksRemaining > 0) return "BUILDING_UNDER_CONSTRUCTION";

      const buildingConfig = BUILDING_CONFIG[b.type];
      if (!buildingConfig.produces.includes(action.unitType)) return "BUILDING_CANNOT_PRODUCE_UNIT";

      const unitConfig = UNIT_CONFIG[action.unitType];
      if (!unitConfig) return "UNKNOWN_UNIT_TYPE";

      // Check costs
      const spawnCostMultiplier = civilization?.bonuses.costMultiplier || {};
      for (const r of Object.keys(unitConfig.cost) as (keyof ResourcePool)[]) {
        const actualCost = (unitConfig.cost[r] || 0) * (spawnCostMultiplier[r] || 1);
        if (state.resources[r] < actualCost)
          return "INSUFFICIENT_RESOURCES";
      }

      const capacity = getHousingCapacity(state.buildings);
      if (state.workers.length >= capacity) return "INSUFFICIENT_HOUSING";

      // Deduct costs
      for (const r of Object.keys(unitConfig.cost) as (keyof ResourcePool)[]) {
        const actualCost = (unitConfig.cost[r] || 0) * (spawnCostMultiplier[r] || 1);
        state.resources[r] -= actualCost;
      }

      const coord = tileIdToCoord(b.tileId);
      state.workers.push({
        id: `w-${state.tickCount}-${state.workers.length}`,
        unitType: action.unitType,
        state: "IDLE",
        assignedBuildingId: null,
        position: { ...coord },
        path: [],
        harvestTicks: 0,
        carrying: null,
        visionRadius: unitConfig.visionRadius,
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
  if (worker.state === "STARVING" && state!.tickCount % 4 !== 0) {
    return;
  }

  switch (worker.state) {
    case "STARVING":
      // Starving units move slower but still follow their role
      if (worker.unitType === "SCOUT") {
        worker.state = "SCOUTING";
      } else {
        worker.state = "IDLE";
      }
      break;
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
        const pathFound = recalculatePath(worker);
        if (!pathFound) {
          worker.state = "IDLE";
          worker.assignedBuildingId = null;
        }
      } else if (worker.unitType === "SCOUT") {
        worker.state = "SCOUTING";
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
        const speedMultiplier = civilization?.bonuses.constructionSpeedMultiplier || 1;
        b.constructionTicksRemaining = Math.max(
          0,
          b.constructionTicksRemaining - 1 * speedMultiplier,
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

    case "MOVING_TO_HARVEST": {
      const targetId = getWorkerTargetTileId(worker);
      if (targetId === null) {
        worker.state = "IDLE";
        worker.assignedBuildingId = null;
        worker.path = [];
        break;
      }

      if (worker.path.length > 0) {
        const next = worker.path.shift()!;
        worker.position = next;
      }

      if (isAtTile(worker, targetId)) {
        worker.state = "HARVESTING";
      } else if (worker.path.length === 0) {
        const pathFound = recalculatePath(worker);
        if (!pathFound) {
          worker.state = "IDLE";
          worker.assignedBuildingId = null;
        }
      }
      break;
    }

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
          const pathFound = recalculatePath(worker);
          if (!pathFound) {
            worker.state = "WAITING";
          }
        } else {
          worker.state = "WAITING";
        }
      }
      break;
    }

    case "MOVING_TO_DEPOSIT": {
      const targetId = getWorkerTargetTileId(worker);
      if (targetId === null) {
        worker.state = "WAITING";
        worker.path = [];
        break;
      }

      if (worker.path.length > 0) {
        const next = worker.path.shift()!;
        worker.position = next;
      }

      if (isAtTile(worker, targetId)) {
        // Check capacity on arrival
        if (hasDepositCapacity(state!.resources, state!.buildings)) {
          worker.state = "DEPOSITING";
        } else {
          worker.state = "WAITING";
        }
      } else if (worker.path.length === 0) {
        const pathFound = recalculatePath(worker);
        if (!pathFound) {
          worker.state = "WAITING";
        }
      }
      break;
    }

    case "DEPOSITING":
      if (worker.carrying) {
        const type = worker.carrying.type;
        depositDelta[type] += worker.carrying.amount;
        worker.carrying = null;
      }
      worker.state = "MOVING_TO_HARVEST";
      {
        const pathFound = recalculatePath(worker);
        if (!pathFound) {
          worker.state = "IDLE";
          worker.assignedBuildingId = null;
        }
      }
      break;

    case "WAITING":
      // Re-check storage capacity each tick
      if (hasDepositCapacity(state!.resources, state!.buildings)) {
        worker.state = "MOVING_TO_DEPOSIT";
        const pathFound = recalculatePath(worker);
        if (!pathFound) {
          worker.state = "WAITING";
        }
      }
      break;

    case "SCOUTING":
      processScouting(worker);
      break;
  }
}

function recalculatePath(worker: WorkerState): boolean {
  if (!state) return false;

  const targetId = getWorkerTargetTileId(worker);
  if (targetId === null) {
    worker.path = [];
    return false;
  }

  if (isAtTile(worker, targetId)) {
    worker.path = [];
    return true;
  }

  const targetCoord = tileIdToCoord(targetId);
  worker.path = findPath(
    worker.position,
    targetCoord,
    state.tiles,
    worker.unitType === "SCOUT",
  );
  return worker.path.length > 0;
}

function findNearestFogTile(position: TileCoordinate): number | null {
  if (!state) return null;

  let bestId: number | null = null;
  let bestDist = Infinity;

  // Scan all tiles for fog (visible: false)
  // Optimization: we could scan in an outward spiral, but 80x80 is small enough for a linear scan
  for (let i = 0; i < state.tiles.length; i++) {
    const tile = state.tiles[i];
    if (tile.visible) continue;

    const coord = tileIdToCoord(i);
    const dist = Math.abs(position.x - coord.x) + Math.abs(position.y - coord.y);

    if (dist < bestDist) {
      bestDist = dist;
      bestId = i;
    }
  }

  return bestId;
}

function processScouting(worker: UnitState) {
  if (!state) return;

  if (worker.path.length > 0) {
    const next = worker.path.shift()!;
    worker.position = next;
    return;
  }

  // Find next fog target
  const targetId = findNearestFogTile(worker.position);
  if (targetId === null) {
    worker.state = "IDLE";
    return;
  }

  // Use a special version of findPath that ignores fog for scouting
  const targetCoord = tileIdToCoord(targetId);
  const path = findPath(worker.position, targetCoord, state.tiles, true); // true = allow scouting into fog
  
  if (path && path.length > 0) {
    worker.path = path;
    const next = worker.path.shift()!;
    worker.position = next;
  } else {
    // If no path to fog, just idle or wander
    worker.state = "IDLE";
  }
}

/** Helper to find a suitable tile for autonomous placement. */
function findAutoPlacementTile(buildingType: BuildingType): number | null {
  if (!state) return null;

  const config = BUILDING_CONFIG[buildingType];
  if (!config) return null;

  // Potential targets are owned, walkable, and empty tiles
  const candidates = state.tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.owned && t.walkable && !t.buildingId);

  if (candidates.length === 0) return null;

  // Biome requirements for specific buildings
  const targetBiome =
    buildingType === "FORAGER_HUT"
      ? "GRASSLAND"
      : buildingType === "LUMBER_MILL"
        ? "FOREST"
        : buildingType === "QUARRY"
          ? "STONE_DEPOSIT"
          : null;

  if (targetBiome) {
    // Score based on biome adjacency
    const scored = candidates.map(({ i }) => {
      let score = 0;
      const cx = i % MAP_WIDTH;
      const cy = Math.floor(i / MAP_WIDTH);
      
      // Check neighbors for biome within radius 2
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx >= 0 && nx < MAP_WIDTH && ny >= 0 && ny < MAP_WIDTH) {
            const nId = ny * MAP_WIDTH + nx;
            if (state!.tiles[nId]?.type === targetBiome) score++;
          }
        }
      }
      return { i, score };
    });

    const townHall = state.buildings.find(b => b.type === "TOWN_HALL");
    const refCoord = townHall ? tileIdToCoord(townHall.tileId) : { x: 40, y: 40 };

    const best = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Tie-breaker: distance to Town Hall
        const ac = tileIdToCoord(a.i);
        const bc = tileIdToCoord(b.i);
        const distA = Math.abs(ac.x - refCoord.x) + Math.abs(ac.y - refCoord.y);
        const distB = Math.abs(bc.x - refCoord.x) + Math.abs(bc.y - refCoord.y);
        return distA - distB;
      })[0];
    if (best) return best.i;
  }

  // Fallback for buildings with biome requirements: if no optimal biome tile is found,
  // allow placement on any owned walkable tile if it's a critical early game building
  if (buildingType === "FORAGER_HUT" || buildingType === "LUMBER_MILL" || buildingType === "QUARRY") {
      // If we don't have ANY of this type, we MUST place it even if not optimal (if the rules allow)
      // Actually the rules REQUIRE adjacency for these. So if no adjacency, we can't place.
      // We should instead signal that we need to expand territory.
  }

  // Generic buildings (Storehouse, Library): Place near Town Hall or existing buildings
  const townHall = state.buildings.find(b => b.type === "TOWN_HALL");
  const referenceId = townHall ? townHall.tileId : state.buildings[0]?.tileId;
  if (referenceId === undefined) return candidates[0].i;

  const refCoord = tileIdToCoord(referenceId);
  candidates.sort((a, b) => {
    const ac = tileIdToCoord(a.i);
    const bc = tileIdToCoord(b.i);
    const distA = Math.abs(ac.x - refCoord.x) + Math.abs(ac.y - refCoord.y);
    const distB = Math.abs(bc.x - refCoord.x) + Math.abs(bc.y - refCoord.y);
    return distA - distB;
  });

  return candidates[0].i;
}

/** Autonomous logic for worker assignment, population growth, and expansion. */
function runAutoPlay() {
  if (!state || !state.autoPlay) return;

  // 0. Construction Rescue: Handle workers stuck in harvesting while construction stalls
  const pendingConstruction = state.buildings.filter(
    (b) => b.constructionTicksRemaining > 0 && !b.constructionWorkerId,
  );
  const idleForConstruction = state.workers.filter(
    (w) => w.state === "IDLE" && !w.assignedBuildingId,
  );

  if (pendingConstruction.length > 0 && idleForConstruction.length === 0 && state.resources.wood >= 10) {
    // Break a harvester to go build
    const harvestWorker = state.workers.find(
      (w) =>
        w.assignedBuildingId !== null &&
        w.state !== "MOVING_TO_CONSTRUCT" &&
        w.state !== "CONSTRUCTING",
    );
    if (harvestWorker) {
      validateAndApplyAction({
        type: "UNASSIGN_WORKER",
        workerId: harvestWorker.id,
      });
    }
  }

  // 0.5. Storage-Aware Unassignment: Stop working if storage is full
  const currentCap = getStorageCapacity(state.buildings);
  const fullResources = Object.keys(state.resources).filter(
    (res) => state!.resources[res as keyof ResourcePool] >= currentCap
  );

  if (fullResources.length > 0) {
    state.workers.forEach((w) => {
      if (w.assignedBuildingId) {
        const b = state!.buildings.find((b) => b.id === w.assignedBuildingId);
        if (b) {
          const config = BUILDING_CONFIG[b.type];
          if (config.resource && fullResources.includes(config.resource)) {
            // Unassign so they can be re-assigned to something we actually need
            validateAndApplyAction({ type: "UNASSIGN_WORKER", workerId: w.id });
          }
        }
      }
    });
  }

  // 0.6. Active Rebalancing: Pull workers to higher-priority (lower score) buildings
  const understaffed = state.buildings.filter((b) => {
    const config = BUILDING_CONFIG[b.type];
    if (b.constructionTicksRemaining > 0) return b.assignedWorkerIds.length < 1;
    return config.resource && b.assignedWorkerIds.length < config.requiredWorkers;
  });

  if (understaffed.length > 0) {
    const sCap = getStorageCapacity(state.buildings);
    const pWeights: Record<string, number> = { 
      // Higher knowledge priority in Era 3 to reach 1000 threshold
      knowledge: state.resources.knowledge >= sCap ? 0 : (state.era === 3 ? 100 : (state.resources.knowledge < 20 ? 100 : 20)), 
      stone: state.resources.stone >= sCap ? 0 : 5, 
      food: state.resources.food < 50 ? 1000 : (state.resources.food >= sCap ? 0 : 2), 
      wood: state.resources.wood >= sCap ? 0 : 20 
    };
  
    // Proactive Food Scaling: Check delta, not just absolute counts
    if (state.resources.food < 100 || state.workers.length > 10) { 
       pWeights.food = 2000; // Even more aggressive
    }
    const getScore = (type: BuildingType) => {
      const config = BUILDING_CONFIG[type];
      const res = config.resource;
      const bFound = state!.buildings.find(b => b.type === type && b.constructionTicksRemaining > 0);
      
      // Construction score: only top priority if we have some wood buffer
      if (bFound) return state!.resources.wood < 8 ? 50 : 0; 

      return res ? (state!.resources[res] || 0) / (pWeights[res] || 1) : Infinity;
    };

    understaffed.sort((a, b) => getScore(a.type) - getScore(b.type));
    const highestPriority = understaffed[0];
    const highestPriorityScore = getScore(highestPriority.type);

    // If no idle workers, pull from lowest priority building (highest score)
    const idleCount = state.workers.filter((w) => w.state === "IDLE" && !w.assignedBuildingId).length;
    if (idleCount === 0) {
      const staffed = state.buildings.filter((b) => b.assignedWorkerIds.length > 0);
      staffed.sort((a, b) => getScore(b.type) - getScore(a.type));

      const lowestPriority = staffed[0];
      if (lowestPriority && getScore(lowestPriority.type) > highestPriorityScore + 5) {
        // Unassign one worker from the lowest priority building
        const workerId = lowestPriority.assignedWorkerIds[0];
        validateAndApplyAction({ type: "UNASSIGN_WORKER", workerId });
      }
    }
  }

  // 1. Automatic Era Advancement
  const nextEra = (state.era + 1) as 2 | 3 | 4;
  const threshold = ERA_THRESHOLDS[state.era as 1 | 2 | 3];
  const popGate = ERA_POPULATION_GATES[state.era as 1 | 2 | 3];
  if (
    state.era < 4 &&
    threshold &&
    state.resources.knowledge >= threshold &&
    state.workers.length >= popGate
  ) {
    validateAndApplyAction({ type: "RESEARCH_ERA", targetEra: nextEra });
  }

  // 2. Goal-Oriented Building Placement & Demolition
  const goals = ERA_BUILDING_GOALS[state.era] || {};
  const storageCap = getStorageCapacity(state.buildings);
  const housingCap = getHousingCapacity(state.buildings);

  // A. Demolition: Remove obsolete buildings
  if (state.era >= 2) {
    const hasOperationalFarm = state.buildings.some(b => b.type === "FARM" && b.constructionTicksRemaining === 0 && b.operational);
    if (hasOperationalFarm) {
      const foragerHut = state.buildings.find(b => b.type === "FORAGER_HUT");
      if (foragerHut) {
        validateAndApplyAction({ type: "DEMOLISH_BUILDING", buildingId: foragerHut.id });
      }
    }
  }

  // B. Mandatory Placement: Work through the Era goals in priority order
  // Priority: 1 Forager -> 1 Mill -> 1 Quarry -> Library -> Storehouse
  const priorityOrder: BuildingType[] = [
    "FORAGER_HUT",
    "LUMBER_MILL",
    "QUARRY",
    "LIBRARY",
    "STOREHOUSE",
    "FARM",
    "BARRACKS",
  ];

  for (const type of priorityOrder) {
    let targetCount = goals[type] || 0;
    
    // Dynamic scaling for Era 3/4 infrastructure to support growing population
    if (state.era >= 3 && type === "FARM") {
      targetCount = Math.max(targetCount, Math.ceil(state.workers.length / 4) + 1);
    }

    if (state.era >= 3 && (type === "LUMBER_MILL" || type === "QUARRY")) {
      targetCount = Math.max(targetCount, Math.ceil(state.workers.length / 4));
    }
    
    // Proactive scale: Ensure food supply remains stable as population grows
    if (type === "FARM") {
      // 1 Farm per 3.5 workers is generally stable
      targetCount = Math.max(targetCount, Math.ceil(state.workers.length / 3.5));
    }

    if (state.era >= 3 && type === "STOREHOUSE") {
      targetCount = Math.max(targetCount, Math.ceil(state.workers.length / 8) + 1);
    }

    const currentCount = state.buildings.filter(b => b.type === type).length;
    
    if (currentCount < targetCount) {
      const tileId = findAutoPlacementTile(type);
      if (tileId !== null) {
        const rejection = validateAndApplyAction({ type: "PLACE_BUILDING", buildingType: type, tileId });
        if (!rejection) break; // Only place one building per tick to avoid resource depletion
      }
    }
  }

  // C. Emergency Infrastructure (Storage/Housing)
  // If storage is near-full, build an extra storehouse regardless of Era goals
  if (state.resources.wood > storageCap * 0.9 || state.resources.stone > storageCap * 0.9) {
    const pendingStorehouse = state.buildings.some(b => b.type === "STOREHOUSE" && b.constructionTicksRemaining > 0);
    if (!pendingStorehouse) {
      const tileId = findAutoPlacementTile("STOREHOUSE");
      if (tileId !== null) validateAndApplyAction({ type: "PLACE_BUILDING", buildingType: "STOREHOUSE", tileId });
    }
  }
  
  // If population is at cap and food is healthy, build a storehouse for housing
  if (state.workers.length >= housingCap && state.resources.food > 150) {
    const pendingStorehouse = state.buildings.some(b => b.type === "STOREHOUSE" && b.constructionTicksRemaining > 0);
    if (!pendingStorehouse) {
      const tileId = findAutoPlacementTile("STOREHOUSE");
      if (tileId !== null) validateAndApplyAction({ type: "PLACE_BUILDING", buildingType: "STOREHOUSE", tileId });
    }
  }

  // 3. Auto-Spawning Workers
  // Threshold: food > safety margin (50 + upkeep buffer) AND housing capacity available
  const spawningSafetyThreshold = 50 + (state.workers.length * 2);
  const pendingConstructionCount = state.buildings.filter(b => b.constructionTicksRemaining > 0).length;
  
  if (state.resources.food >= spawningSafetyThreshold && state.workers.length < housingCap && pendingConstructionCount <= 2) {
    validateAndApplyAction({ type: "SPAWN_WORKER" });
  }

  // 4. Auto-assignment (Existing logic)
  const idleWorkers = state.workers.filter(
    (w) => w.state === "IDLE" && !w.assignedBuildingId,
  );
  if (idleWorkers.length > 0) {
    const assignableBuildings = state.buildings.filter((b) => {
      const config = BUILDING_CONFIG[b.type];
      // Can assign to build (if ticks remaining) or harvest (if finished and has resource)
      if (b.constructionTicksRemaining > 0) {
        return b.assignedWorkerIds.length < 1;
      }
      return (
        config.resource &&
        b.assignedWorkerIds.length < config.requiredWorkers
      );
    });

    for (const worker of idleWorkers) {
      if (assignableBuildings.length === 0) break;

      // Pick building with highest priority based on resource needs (weighted)
      assignableBuildings.sort((a, b) => {
        const confA = BUILDING_CONFIG[a.type];
        const confB = BUILDING_CONFIG[b.type];
        
        // Resource priorities matching rebalancing weights
        const storageCap = getStorageCapacity(state!.buildings);
        const p: Record<string, number> = { 
          knowledge: state!.resources.knowledge >= storageCap ? 0 : (state!.resources.knowledge < 20 ? 100 : 20), 
          stone: state!.resources.stone >= storageCap ? 0 : 5, 
          food: state!.resources.food < 50 ? 1000 : (state!.resources.food >= storageCap ? 0 : 2), 
          wood: state!.resources.wood >= storageCap ? 0 : 20 
        };
        
        // Prioritize construction first, but only if wood is available
        const hasWoodBuffer = state!.resources.wood >= 8;
        if (hasWoodBuffer && a.constructionTicksRemaining > 0 && b.constructionTicksRemaining === 0) return -1;
        if (hasWoodBuffer && b.constructionTicksRemaining > 0 && a.constructionTicksRemaining === 0) return 1;

        const scoreA = (confA.resource ? (state!.resources[confA.resource] || 0) : 0) / (p[confA.resource || ""] || 1);
        const scoreB = (confB.resource ? (state!.resources[confB.resource] || 0) : 0) / (p[confB.resource || ""] || 1);
        
        return scoreA - scoreB; // Assign to the "most needed" (lowest weighted score)
      });

      const b = assignableBuildings[0];
      validateAndApplyAction({
        type: "ASSIGN_WORKER",
        workerId: worker.id,
        buildingId: b.id,
      });

      const config = BUILDING_CONFIG[b.type];
      if (b.assignedWorkerIds.length >= config.requiredWorkers) {
        assignableBuildings.shift();
      }
    }
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

export const __test__ = {
  setState(nextState: GameState) {
    state = nextState;
    actionQueue = [];
    paused = false;
    tickTimeoutId = null;
    tickMs = BASE_TICK_MS;
    eraChangedThisTick = false;
  },
  getState() {
    return state;
  },
  queueAction(action: PlayerAction) {
    actionQueue.push(action);
  },
  clearActions() {
    actionQueue = [];
  },
  runTick,
  validateAndApplyAction,
  processWorkerStateMachine,
  recalculatePath,
  getHousingCapacity,
};

if (typeof self !== "undefined" && "addEventListener" in self) {
  self.addEventListener("message", (e: MessageEvent<WorkerInbound>) => {
    const msg = e.data;
    switch (msg.type) {
      case "INIT":
        if (tickTimeoutId) clearTimeout(tickTimeoutId);
        state = msg.state;
        civilization = getCivilization(state.civilizationId);
        actionQueue = [];
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
      case "TOGGLE_AUTO_PLAY":
        if (state) state.autoPlay = msg.enabled;
        break;
    }
  });
}

