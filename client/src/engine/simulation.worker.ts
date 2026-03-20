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
  CivilizationId,
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

/** Maximum workers per AI civilization to keep ticks performant. */
const AI_WORKER_CAP = 30;

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
let actionQueue: PlayerAction[] = [];
let paused = false;
let tickTimeoutId: ReturnType<typeof setTimeout> | null = null;
let tickMs = BASE_TICK_MS;
let ticksPerLoop = 1;
let eraChangedThisTick = false;

// ─── Scoped query helpers ─────────────────────────────────────────────

/** Get all buildings owned by a specific civ. */
function getBuildingsFor(civId: CivilizationId): BuildingState[] {
  return state!.buildings.filter(b => b.ownerId === civId);
}

/** Get all workers/units owned by a specific civ. */
function getWorkersFor(civId: CivilizationId): UnitState[] {
  return state!.workers.filter(w => w.ownerId === civId);
}

/** Update visibility for all tiles within a unit's vision radius. */
function updateVision(unit: UnitState, tiles: TileState[]) {
  const civ = getCivilization(unit.ownerId);
  const visionBoost = civ?.bonuses.visionRadiusBoost || 0;
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

/** Compute current storage capacity based on placed Storehouses for a civ. */
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

/** Find nearest drop-off (Storehouse/Town Hall) owned by the same civ. */
function getNearestDropoffTileId(position: TileCoordinate, civId: CivilizationId): number | null {
  if (!state) return null;

  const dropoffs = state.buildings
    .filter(
      (b) =>
        b.ownerId === civId &&
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
    return getNearestDropoffTileId(worker.position, worker.ownerId);
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

/** Assign idle workers to pending construction — scoped to a given civ. */
function assignConstructionWorkers(civId: CivilizationId) {
  if (!state) return;

  const civWorkers = getWorkersFor(civId);
  const civBuildings = getBuildingsFor(civId);

  const idleWorkers = [...civWorkers]
    .filter((w) => w.state === "IDLE" && w.assignedBuildingId === null)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (idleWorkers.length === 0) return;

  const pendingBuildings = [...civBuildings]
    .filter(
      (b) => b.constructionTicksRemaining > 0 && !b.constructionWorkerId,
    )
    .sort((a, b) => a.id.localeCompare(b.id));

  // Cap construction workers to 25% of population (min 1, max 5)
  const currentlyBuilding = civWorkers.filter(w => w.state === "MOVING_TO_CONSTRUCT" || w.state === "CONSTRUCTING").length;
  const constructionCap = Math.max(1, Math.min(5, Math.floor(civWorkers.length * 0.25)));
  
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

// ─── Main tick loop ───────────────────────────────────────────────────

function runTick() {
  if (!state) return;

  syncBuildingAssignments();

  const actionRejections: { action: PlayerAction; reason: string }[] = [];
  eraChangedThisTick = false;

  // Snapshot player resources before tick for delta calc
  const playerCivState = state.civStates[state.playerCivId];
  const playerResourcesBefore: ResourcePool = playerCivState 
    ? { ...playerCivState.resources }
    : { food: 0, wood: 0, stone: 0, knowledge: 0 };

  // ─── STEP 1 — Drain action queue (player only, FIFO) ───
  const currentActions = [...actionQueue];
  actionQueue = [];

  for (const action of currentActions) {
    const rejection = validateAndApplyAction(action, state.playerCivId);
    if (rejection) {
      actionRejections.push({ action, reason: rejection });
    }
  }

  // ─── STEP 2 — Per-civ processing ───
  const buildingUpdates: {
    id: string;
    staffed: boolean;
    operational: boolean;
  }[] = [];

  for (const civId of state.activeCivs) {
    const civState = state.civStates[civId];
    if (!civState) continue;
    const civ = getCivilization(civId);
    const civBuildings = getBuildingsFor(civId);
    const civWorkers = getWorkersFor(civId);

    // Assign idle workers to construction
    assignConstructionWorkers(civId);

    // Run auto-play for AI civs (always) and player (if toggled)
    if (civId !== state.playerCivId || civState.autoPlay) {
      runAutoPlay(civId);
    }

    // ─── STEP 2a — Evaluate worker state machines ───
    const workers = [...civWorkers].sort((a, b) => a.id.localeCompare(b.id));
    const workerDepositDelta: ResourcePool = {
      food: 0,
      wood: 0,
      stone: 0,
      knowledge: 0,
    };

    for (const worker of workers) {
      processWorkerStateMachine(worker, workerDepositDelta, civId);
      updateVision(worker, state!.tiles);
    }

    // ─── STEP 2b — Production ───
    const productionDelta: ResourcePool = {
      food: 0,
      wood: 0,
      stone: 0,
      knowledge: 0,
    };

    const buildings = [...civBuildings].sort((a, b) =>
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
        const yieldBoost = civ?.bonuses.yieldMultiplier?.[config.resource] || 1;
        productionDelta[config.resource] += config.yieldAmount * yieldBoost;
      }
      buildingUpdates.push({
        id: b.id,
        staffed: b.staffed,
        operational: b.operational,
      });
    }

    // ─── STEP 2c — Consumption ───
    const foodUpkeep = civWorkers.length;
    const hasFoodProducer = civBuildings.some(b =>
      (b.type === "FORAGER_HUT" || b.type === "FARM") && b.operational
    );

    if (hasFoodProducer) {
      civState.resources.food -= foodUpkeep;
    }

    if (civState.resources.food < 0) {
      civState.resources.food = 0;
      civWorkers.forEach((w) => {
        w.state = "STARVING";
      });
    } else if (civState.resources.food > 0 || !hasFoodProducer) {
      civWorkers.forEach((w) => {
        if (w.state === "STARVING") w.state = "IDLE";
      });
    }

    // ─── STEP 2d — Commit delta to civ ResourcePool ───
    const capacity = getStorageCapacity(civBuildings);

    const combinedDelta: ResourcePool = {
      food: productionDelta.food + workerDepositDelta.food,
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
      civState.resources[key] = Math.round(
        Math.min(
          Math.max(0, civState.resources[key] + combinedDelta[key]),
          capacity,
        )
      );
    }
  }

  syncBuildingAssignments();

  // ─── STEP 3 — Compute TickResult delta & emit ───
  state.tickCount++;

  const playerCivStateAfter = state.civStates[state.playerCivId];
  const resourceDelta: ResourcePool = playerCivStateAfter ? {
    food: playerCivStateAfter.resources.food - playerResourcesBefore.food,
    wood: playerCivStateAfter.resources.wood - playerResourcesBefore.wood,
    stone: playerCivStateAfter.resources.stone - playerResourcesBefore.stone,
    knowledge: playerCivStateAfter.resources.knowledge - playerResourcesBefore.knowledge,
  } : { food: 0, wood: 0, stone: 0, knowledge: 0 };

  const tickResult: TickResult = {
    type: "TICK_RESULT",
    tickCount: state.tickCount,
    civStates: { ...state.civStates },
    playerCivId: state.playerCivId,
    resourceDelta,
    workerPositions: state.workers.map((w) => ({
      id: w.id,
      tileId: w.position.y * MAP_WIDTH + w.position.x,
      state: w.state,
    })),
    buildingUpdates,
    eraChanged: eraChangedThisTick,
    newEra: state.civStates[state.playerCivId]?.era,
    actionRejections,
    workers: state.workers.map((w) => ({ ...w, path: [...w.path] })),
    buildings: state.buildings.map((b) => ({
      ...b,
      assignedWorkerIds: [...b.assignedWorkerIds],
    })),
    tiles: state.tiles,
  };

  emit(tickResult);
}

// ─── Action validation ────────────────────────────────────────────────

function validateAndApplyAction(action: PlayerAction, civId: CivilizationId): string | null {
  if (!state) return "NO_STATE";
  const civState = state.civStates[civId];
  if (!civState) return "NO_CIV_STATE";
  const civ = getCivilization(civId);

  switch (action.type) {
    case "PLACE_BUILDING": {
      const tile = state.tiles[action.tileId];
      if (!tile) return "TILE_NOT_FOUND";
      if (!tile.walkable || tile.buildingId) return "TILE_INVALID";
      // Must be owned by this civ or unclaimed
      if (tile.owned && tile.ownerId !== civId) return "TILE_INVALID";
      // If not owned, allow placement on unclaimed tiles within habitable range
      if (!tile.owned) return "TILE_INVALID";

      const config = BUILDING_CONFIG[action.buildingType];
      if (!config) return "UNKNOWN_BUILDING_TYPE";
      if (civState.era < config.requiredEra) return "ERA_LOCKED";
      if (
        action.buildingType === "TOWN_HALL" &&
        getBuildingsFor(civId).some((b) => b.type === "TOWN_HALL")
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

      // Check costs against this civ's resources
      const cost = config.cost;
      const costMultiplier = civ?.bonuses.costMultiplier || {};
      for (const r of Object.keys(cost) as (keyof ResourcePool)[]) {
        const actualCost = (cost[r] || 0) * (costMultiplier[r] || 1);
        if (civState.resources[r] < actualCost)
          return "INSUFFICIENT_RESOURCES";
      }

      // Deduct costs from this civ's resources
      for (const r of Object.keys(cost) as (keyof ResourcePool)[]) {
        const actualCost = (cost[r] || 0) * (costMultiplier[r] || 1);
        civState.resources[r] -= actualCost;
      }

      const building: BuildingState = {
        id: `b-${civId}-${state.tickCount}-${action.tileId}`,
        ownerId: civId,
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

      // Expand territory around the new building — scoped to this civ
      expandTerritory(state.tiles, action.tileId, civId, 3, 5);

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

      // First TOWN_HALL placement spawns 3 workers for this civ
      if (action.buildingType === "TOWN_HALL" && getWorkersFor(civId).length === 0) {
        const coord = tileIdToCoord(action.tileId);
        const unitConf = UNIT_CONFIG.WORKER;
        const visionBoost = civ?.bonuses.visionRadiusBoost || 0;
        for (let i = 0; i < 3; i++) {
          state.workers.push({
            id: `w-${civId}-${state.tickCount}-${i}`,
            ownerId: civId,
            unitType: "WORKER",
            state: "IDLE",
            assignedBuildingId: null,
            position: { ...coord },
            path: [],
            harvestTicks: 0,
            carrying: null,
            visionRadius: unitConf.visionRadius + visionBoost,
          });
        }
        // Give starting food to prevent immediate starvation
        civState.resources.food = Math.max(civState.resources.food, 20);
        civState.townHallTileId = action.tileId;
      }
      return null;
    }

    case "DEMOLISH_BUILDING": {
      const bIndex = state.buildings.findIndex(
        (b) => b.id === action.buildingId && b.ownerId === civId,
      );
      if (bIndex === -1) return "BUILDING_NOT_FOUND";
      const b = state.buildings[bIndex];
      if (b.type === "TOWN_HALL") return "CANNOT_DEMOLISH_TOWN_HALL";
      const housingLoss =
        b.constructionTicksRemaining === 0 ? (HOUSING_CAPACITY[b.type] ?? 0) : 0;
      if (housingLoss > 0) {
        const civBuildings = getBuildingsFor(civId);
        const civWorkers = getWorkersFor(civId);
        const capacityAfter = getHousingCapacity(civBuildings) - housingLoss;
        if (civWorkers.length > capacityAfter) {
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
      const w = state.workers.find((worker) => worker.id === action.workerId && worker.ownerId === civId);
      const b = state.buildings.find(
        (building) => building.id === action.buildingId && building.ownerId === civId,
      );
      if (!w || !b) return "INVALID_TARGETS";
      if (w.assignedBuildingId !== null) return "WORKER_ALREADY_ASSIGNED";

      const config = BUILDING_CONFIG[b.type];
      if (b.constructionTicksRemaining === 0) {
        if (!config || config.requiredWorkers === 0 || !config.resource) {
          return "BUILDING_NOT_ASSIGNABLE";
        }
        if (b.assignedWorkerIds.length >= config.requiredWorkers) {
          return "BUILDING_FULLY_STAFFED";
        }
      } else {
        if (b.constructionWorkerId) {
          return "BUILDING_ALREADY_BEING_BUILT";
        }
        if (b.assignedWorkerIds.length >= 1) {
          return "BUILDING_ALREADY_BEING_BUILT";
        }
        b.constructionWorkerId = w.id;
      }

      w.assignedBuildingId = b.id;
      b.assignedWorkerIds.push(w.id);
      w.state = "IDLE";
      w.path = [];
      return null;
    }

    case "UNASSIGN_WORKER": {
      const w = state.workers.find((worker) => worker.id === action.workerId && worker.ownerId === civId);
      if (!w || w.assignedBuildingId === null) return "NOT_ASSIGNED";

      const b = state.buildings.find(
        (building) => building.id === w.assignedBuildingId,
      );
      if (b) {
        b.assignedWorkerIds = b.assignedWorkerIds.filter((id) => id !== w.id);
        if (b.constructionWorkerId === w.id) {
          b.constructionWorkerId = null;
        }
      }

      w.assignedBuildingId = null;
      w.state = "IDLE";
      w.path = [];
      w.carrying = null;
      w.harvestTicks = 0;
      return null;
    }

    case "RESEARCH_ERA": {
      if (civState.era !== action.targetEra - 1) return "INVALID_ERA_ORDER";
      const threshold =
        ERA_THRESHOLDS[civState.era as keyof typeof ERA_THRESHOLDS];
      const popGate =
        ERA_POPULATION_GATES[civState.era as keyof typeof ERA_POPULATION_GATES];

      if (!threshold || !popGate) return "INVALID_ERA_ORDER";
      if (civState.resources.knowledge < threshold)
        return "INSUFFICIENT_KNOWLEDGE";
      
      const civWorkers = getWorkersFor(civId);
      if (civWorkers.length < popGate) return "INSUFFICIENT_POPULATION";

      civState.resources.knowledge -= threshold;
      civState.era = action.targetEra;
      if (civId === state.playerCivId) {
        eraChangedThisTick = true;
      }
      return null;
    }

    case "SPAWN_WORKER": {
      const townHall = getBuildingsFor(civId).find((b) => b.type === "TOWN_HALL");
      if (!townHall) return "TOWN_HALL_MISSING";
      return validateAndApplyAction({ 
        type: "SPAWN_UNIT", 
        unitType: "WORKER", 
        buildingId: townHall.id 
      }, civId);
    }

    case "SPAWN_UNIT": {
      const b = state.buildings.find(building => building.id === action.buildingId && building.ownerId === civId);
      if (!b) return "BUILDING_NOT_FOUND";
      if (b.constructionTicksRemaining > 0) return "BUILDING_UNDER_CONSTRUCTION";

      const buildingConfig = BUILDING_CONFIG[b.type];
      if (!buildingConfig.produces.includes(action.unitType)) return "BUILDING_CANNOT_PRODUCE_UNIT";

      const unitConfig = UNIT_CONFIG[action.unitType];
      if (!unitConfig) return "UNKNOWN_UNIT_TYPE";

      // Check costs against this civ's resources
      const spawnCostMultiplier = civ?.bonuses.costMultiplier || {};
      for (const r of Object.keys(unitConfig.cost) as (keyof ResourcePool)[]) {
        const actualCost = (unitConfig.cost[r] || 0) * (spawnCostMultiplier[r] || 1);
        if (civState.resources[r] < actualCost)
          return "INSUFFICIENT_RESOURCES";
      }

      const civBuildings = getBuildingsFor(civId);
      const civWorkers = getWorkersFor(civId);
      const capacity = getHousingCapacity(civBuildings);
      if (civWorkers.length >= capacity) return "INSUFFICIENT_HOUSING";

      // Deduct costs from this civ's resources
      for (const r of Object.keys(unitConfig.cost) as (keyof ResourcePool)[]) {
        const actualCost = (unitConfig.cost[r] || 0) * (spawnCostMultiplier[r] || 1);
        civState.resources[r] -= actualCost;
      }

      const coord = tileIdToCoord(b.tileId);
      const visionBoost = civ?.bonuses.visionRadiusBoost || 0;
      state.workers.push({
        id: `w-${civId}-${state.tickCount}-${civWorkers.length}`,
        ownerId: civId,
        unitType: action.unitType,
        state: "IDLE",
        assignedBuildingId: null,
        position: { ...coord },
        path: [],
        harvestTicks: 0,
        carrying: null,
        visionRadius: unitConfig.visionRadius + visionBoost,
      });
      return null;
    }

    default:
      return "UNKNOWN_ACTION";
  }
}

// ─── Worker state machine ─────────────────────────────────────────────

function processWorkerStateMachine(
  worker: WorkerState,
  depositDelta: ResourcePool,
  civId: CivilizationId,
) {
  if (worker.state === "STARVING" && state!.tickCount % 4 !== 0) {
    return;
  }

  switch (worker.state) {
    case "STARVING":
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
        const civ = getCivilization(civId);
        const speedMultiplier = civ?.bonuses.constructionSpeedMultiplier || 1;
        b.constructionTicksRemaining = Math.max(
          0,
          Math.round(b.constructionTicksRemaining - speedMultiplier),
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

        const civState = state!.civStates[civId];
        const civBuildings = getBuildingsFor(civId);
        if (hasDepositCapacity(civState.resources, civBuildings)) {
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
        const civState = state!.civStates[civId];
        const civBuildings = getBuildingsFor(civId);
        if (hasDepositCapacity(civState.resources, civBuildings)) {
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

    case "WAITING": {
      const civState = state!.civStates[civId];
      const civBuildings = getBuildingsFor(civId);
      if (hasDepositCapacity(civState.resources, civBuildings)) {
        worker.state = "MOVING_TO_DEPOSIT";
        const pathFound = recalculatePath(worker);
        if (!pathFound) {
          worker.state = "WAITING";
        }
      }
      break;
    }

    case "SCOUTING":
      processScouting(worker);
      break;
  }
}

// ─── Path helpers ─────────────────────────────────────────────────────

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

  const targetId = findNearestFogTile(worker.position);
  if (targetId === null) {
    worker.state = "IDLE";
    return;
  }

  const targetCoord = tileIdToCoord(targetId);
  const path = findPath(worker.position, targetCoord, state.tiles, true);
  
  if (path && path.length > 0) {
    worker.path = path;
    const next = worker.path.shift()!;
    worker.position = next;
  } else {
    worker.state = "IDLE";
  }
}

// ─── Autonomous (AutoPlay) AI ─────────────────────────────────────────

/** Helper to find a suitable tile for autonomous placement — scoped to a civ. */
function findAutoPlacementTile(buildingType: BuildingType, civId: CivilizationId): number | null {
  if (!state) return null;

  const config = BUILDING_CONFIG[buildingType];
  if (!config) return null;

  // Potential targets are owned by this civ, walkable, and empty
  const candidates = state.tiles
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => t.ownerId === civId && t.walkable && !t.buildingId);

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
    const scored = candidates.map(({ i }) => {
      let score = 0;
      const cx = i % MAP_WIDTH;
      const cy = Math.floor(i / MAP_WIDTH);
      
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

    const civState = state.civStates[civId];
    const refTileId = civState?.townHallTileId;
    const refCoord = refTileId != null ? tileIdToCoord(refTileId) : { x: 40, y: 40 };

    const best = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const ac = tileIdToCoord(a.i);
        const bc = tileIdToCoord(b.i);
        const distA = Math.abs(ac.x - refCoord.x) + Math.abs(ac.y - refCoord.y);
        const distB = Math.abs(bc.x - refCoord.x) + Math.abs(bc.y - refCoord.y);
        return distA - distB;
      })[0];
    if (best) return best.i;
  }

  // Generic buildings: place near Town Hall
  const civState = state.civStates[civId];
  const refTileId = civState?.townHallTileId;
  if (refTileId == null) return candidates[0]?.i ?? null;

  const refCoord = tileIdToCoord(refTileId);
  candidates.sort((a, b) => {
    const ac = tileIdToCoord(a.i);
    const bc = tileIdToCoord(b.i);
    const distA = Math.abs(ac.x - refCoord.x) + Math.abs(ac.y - refCoord.y);
    const distB = Math.abs(bc.x - refCoord.x) + Math.abs(bc.y - refCoord.y);
    return distA - distB;
  });

  return candidates[0]?.i ?? null;
}

/** Autonomous logic for worker assignment, population growth, and expansion — scoped to one civ. */
function runAutoPlay(civId: CivilizationId) {
  if (!state) return;
  const civState = state.civStates[civId];
  if (!civState) return;

  const civBuildings = getBuildingsFor(civId);
  const civWorkers = getWorkersFor(civId);
  const isAI = civId !== state.playerCivId;

  // 0. Construction Rescue
  const pendingConstruction = civBuildings.filter(
    (b) => b.constructionTicksRemaining > 0 && !b.constructionWorkerId,
  );
  const idleForConstruction = civWorkers.filter(
    (w) => w.state === "IDLE" && !w.assignedBuildingId,
  );

  if (pendingConstruction.length > 0 && idleForConstruction.length === 0 && civState.resources.wood >= 10) {
    const harvestWorker = civWorkers.find(
      (w) =>
        w.assignedBuildingId !== null &&
        w.state !== "MOVING_TO_CONSTRUCT" &&
        w.state !== "CONSTRUCTING",
    );
    if (harvestWorker) {
      validateAndApplyAction({ type: "UNASSIGN_WORKER", workerId: harvestWorker.id }, civId);
    }
  }

  // 0.5. Storage-Aware Unassignment
  const currentCap = getStorageCapacity(civBuildings);
  const fullResources = Object.keys(civState.resources).filter(
    (res) => civState.resources[res as keyof ResourcePool] >= currentCap
  );

  if (fullResources.length > 0) {
    civWorkers.forEach((w) => {
      if (w.assignedBuildingId) {
        const b = state!.buildings.find((b) => b.id === w.assignedBuildingId);
        if (b) {
          const config = BUILDING_CONFIG[b.type];
          if (config.resource && fullResources.includes(config.resource)) {
            validateAndApplyAction({ type: "UNASSIGN_WORKER", workerId: w.id }, civId);
          }
        }
      }
    });
  }

  // 0.6. Active Rebalancing
  const understaffed = civBuildings.filter((b) => {
    const config = BUILDING_CONFIG[b.type];
    if (b.constructionTicksRemaining > 0) return b.assignedWorkerIds.length < 1;
    return config.resource && b.assignedWorkerIds.length < config.requiredWorkers;
  });

  if (understaffed.length > 0) {
    const sCap = getStorageCapacity(civBuildings);
    const pWeights: Record<string, number> = { 
      knowledge: civState.resources.knowledge >= sCap ? 0 : (civState.era === 3 ? 100 : (civState.resources.knowledge < 20 ? 100 : 20)), 
      stone: civState.resources.stone >= sCap ? 0 : 5, 
      food: civState.resources.food < 50 ? 1000 : (civState.resources.food >= sCap ? 0 : 2), 
      wood: civState.resources.wood >= sCap ? 0 : 20 
    };
  
    if (civState.resources.food < 100 || civWorkers.length > 10) { 
       pWeights.food = 2000;
    }
    const getScore = (type: BuildingType) => {
      const config = BUILDING_CONFIG[type];
      const res = config.resource;
      const bFound = civBuildings.find(b => b.type === type && b.constructionTicksRemaining > 0);
      
      if (bFound) return civState.resources.wood < 8 ? 50 : 0; 

      return res ? (civState.resources[res] || 0) / (pWeights[res] || 1) : Infinity;
    };

    understaffed.sort((a, b) => getScore(a.type) - getScore(b.type));
    const highestPriority = understaffed[0];
    const highestPriorityScore = getScore(highestPriority.type);

    const idleCount = civWorkers.filter((w) => w.state === "IDLE" && !w.assignedBuildingId).length;
    if (idleCount === 0) {
      const staffed = civBuildings.filter((b) => b.assignedWorkerIds.length > 0);
      staffed.sort((a, b) => getScore(b.type) - getScore(a.type));

      const lowestPriority = staffed[0];
      if (lowestPriority && getScore(lowestPriority.type) > highestPriorityScore + 5) {
        const workerId = lowestPriority.assignedWorkerIds[0];
        validateAndApplyAction({ type: "UNASSIGN_WORKER", workerId }, civId);
      }
    }
  }

  // 1. Automatic Era Advancement
  const nextEra = (civState.era + 1) as 2 | 3 | 4;
  const threshold = ERA_THRESHOLDS[civState.era as 1 | 2 | 3];
  const popGate = ERA_POPULATION_GATES[civState.era as 1 | 2 | 3];
  if (
    civState.era < 4 &&
    threshold &&
    civState.resources.knowledge >= threshold &&
    civWorkers.length >= popGate
  ) {
    validateAndApplyAction({ type: "RESEARCH_ERA", targetEra: nextEra }, civId);
  }

  // 2. Goal-Oriented Building Placement
  const goals = ERA_BUILDING_GOALS[civState.era] || {};
  const storageCap = getStorageCapacity(civBuildings);
  const housingCap = getHousingCapacity(civBuildings);

  // A. Demolition: Remove obsolete buildings
  if (civState.era >= 2) {
    const hasOperationalFarm = civBuildings.some(b => b.type === "FARM" && b.constructionTicksRemaining === 0 && b.operational);
    if (hasOperationalFarm) {
      const foragerHut = civBuildings.find(b => b.type === "FORAGER_HUT");
      if (foragerHut) {
        validateAndApplyAction({ type: "DEMOLISH_BUILDING", buildingId: foragerHut.id }, civId);
      }
    }
  }

  // B. Mandatory Placement
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
    
    if (civState.era >= 3 && type === "FARM") {
      targetCount = Math.max(targetCount, Math.ceil(civWorkers.length / 4) + 1);
    }
    if (civState.era >= 3 && (type === "LUMBER_MILL" || type === "QUARRY")) {
      targetCount = Math.max(targetCount, Math.ceil(civWorkers.length / 4));
    }
    if (type === "FARM") {
      targetCount = Math.max(targetCount, Math.ceil(civWorkers.length / 3.5));
    }
    if (civState.era >= 3 && type === "STOREHOUSE") {
      targetCount = Math.max(targetCount, Math.ceil(civWorkers.length / 8) + 1);
    }

    const currentCount = civBuildings.filter(b => b.type === type).length;
    
    if (currentCount < targetCount) {
      const tileId = findAutoPlacementTile(type, civId);
      if (tileId !== null) {
        const rejection = validateAndApplyAction({ type: "PLACE_BUILDING", buildingType: type, tileId }, civId);
        if (!rejection) break;
      }
    }
  }

  // C. Emergency Infrastructure
  if (civState.resources.wood > storageCap * 0.9 || civState.resources.stone > storageCap * 0.9) {
    const pendingStorehouse = civBuildings.some(b => b.type === "STOREHOUSE" && b.constructionTicksRemaining > 0);
    if (!pendingStorehouse) {
      const tileId = findAutoPlacementTile("STOREHOUSE", civId);
      if (tileId !== null) validateAndApplyAction({ type: "PLACE_BUILDING", buildingType: "STOREHOUSE", tileId }, civId);
    }
  }
  
  if (civWorkers.length >= housingCap && civState.resources.food > 150) {
    const pendingStorehouse = civBuildings.some(b => b.type === "STOREHOUSE" && b.constructionTicksRemaining > 0);
    if (!pendingStorehouse) {
      const tileId = findAutoPlacementTile("STOREHOUSE", civId);
      if (tileId !== null) validateAndApplyAction({ type: "PLACE_BUILDING", buildingType: "STOREHOUSE", tileId }, civId);
    }
  }

  // 3. Auto-Spawning Workers (with AI cap)
  const spawningSafetyThreshold = 50 + (civWorkers.length * 2);
  const pendingConstructionCount = civBuildings.filter(b => b.constructionTicksRemaining > 0).length;
  const workerCap = isAI ? AI_WORKER_CAP : Infinity;
  
  if (
    civState.resources.food >= spawningSafetyThreshold && 
    civWorkers.length < housingCap && 
    civWorkers.length < workerCap &&
    pendingConstructionCount <= 2
  ) {
    validateAndApplyAction({ type: "SPAWN_WORKER" }, civId);
  }

  // 4. Auto-assignment
  const idleWorkers = civWorkers.filter(
    (w) => w.state === "IDLE" && !w.assignedBuildingId,
  );
  if (idleWorkers.length > 0) {
    const assignableBuildings = civBuildings.filter((b) => {
      const config = BUILDING_CONFIG[b.type];
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

      assignableBuildings.sort((a, b) => {
        const confA = BUILDING_CONFIG[a.type];
        const confB = BUILDING_CONFIG[b.type];
        
        const storageCap = getStorageCapacity(civBuildings);
        const p: Record<string, number> = { 
          knowledge: civState.resources.knowledge >= storageCap ? 0 : (civState.resources.knowledge < 20 ? 100 : 20), 
          stone: civState.resources.stone >= storageCap ? 0 : 5, 
          food: civState.resources.food < 50 ? 1000 : (civState.resources.food >= storageCap ? 0 : 2), 
          wood: civState.resources.wood >= storageCap ? 0 : 20 
        };
        
        const hasWoodBuffer = civState.resources.wood >= 8;
        if (hasWoodBuffer && a.constructionTicksRemaining > 0 && b.constructionTicksRemaining === 0) return -1;
        if (hasWoodBuffer && b.constructionTicksRemaining > 0 && a.constructionTicksRemaining === 0) return 1;

        const scoreA = (confA.resource ? (civState.resources[confA.resource] || 0) : 0) / (p[confA.resource || ""] || 1);
        const scoreB = (confB.resource ? (civState.resources[confB.resource] || 0) : 0) / (p[confB.resource || ""] || 1);
        
        return scoreA - scoreB;
      });

      const b = assignableBuildings[0];
      validateAndApplyAction({
        type: "ASSIGN_WORKER",
        workerId: worker.id,
        buildingId: b.id,
      }, civId);

      const config = BUILDING_CONFIG[b.type];
      if (b.assignedWorkerIds.length >= config.requiredWorkers) {
        assignableBuildings.shift();
      }
    }
  }
}

// ─── Tick scheduling ──────────────────────────────────────────────────

function scheduleTick() {
  if (paused) return;
  tickTimeoutId = setTimeout(() => {
    // Run the logic multiple times instantly before scheduling the next frame
    // This allows speeds well beyond 100x
    for (let i = 0; i < ticksPerLoop; i++) {
        runTick();
    }
    scheduleTick();
  }, tickMs);
}

function setSpeed(multiplier: number) {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return;
  
  // Calculate how fast the interval should ideally be
  const idealTickMs = BASE_TICK_MS / multiplier;
  
  if (idealTickMs < MIN_TICK_MS) {
    // We can't fire timeouts faster than MIN_TICK_MS limits
    // So we fire every MIN_TICK_MS and run multiple logic ticks at once to make up for it
    tickMs = MIN_TICK_MS;
    ticksPerLoop = Math.ceil(MIN_TICK_MS / idealTickMs);
  } else {
    tickMs = Math.floor(idealTickMs);
    ticksPerLoop = 1;
  }
  
  if (!paused) {
    if (tickTimeoutId) clearTimeout(tickTimeoutId);
    scheduleTick();
  }
}

// ─── Test harness ─────────────────────────────────────────────────────

export const __test__ = {
  setState(nextState: GameState) {
    state = nextState;
    actionQueue = [];
    paused = false;
    tickTimeoutId = null;
    tickMs = BASE_TICK_MS;
    ticksPerLoop = 1;
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

// ─── Worker message handler ───────────────────────────────────────────

if (typeof self !== "undefined" && "addEventListener" in self) {
  self.addEventListener("message", (e: MessageEvent<WorkerInbound>) => {
    const msg = e.data;
    switch (msg.type) {
      case "INIT":
        if (tickTimeoutId) clearTimeout(tickTimeoutId);
        state = msg.state;
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
        if (state) {
          const playerCivState = state.civStates[state.playerCivId];
          if (playerCivState) {
            playerCivState.autoPlay = msg.enabled;
          }
        }
        break;
    }
  });
}
