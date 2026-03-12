// NO Math.random() — simulation must be deterministic

/** The four resource types in the game economy. */
export type ResourceType = "food" | "wood" | "stone" | "knowledge";

/**
 * Tracks the current quantity of each resource.
 * Used both as absolute totals and as per-tick deltas.
 */
export interface ResourcePool {
  food: number;
  wood: number;
  stone: number;
  knowledge: number;
}

/** Terrain classification for each tile on the map grid. */
export type TileType =
  | "GRASSLAND"
  | "FOREST"
  | "STONE_DEPOSIT"
  | "WATER"
  | "BARREN";

/** A 2D coordinate on the tile grid (0-indexed). */
export interface TileCoordinate {
  x: number;
  y: number;
}

/**
 * The state of a single tile on the 80×80 map grid.
 * `id` is computed as `row * MAP_WIDTH + col`.
 */
export interface TileState {
  /** Unique identifier: row * MAP_WIDTH + col. */
  id: number;
  /** Terrain type controlling walkability and resource node rules. */
  type: TileType;
  /** Whether this tile is claimed by the player's settlement. */
  owned: boolean;
  /** Whether workers can traverse this tile (false for Water, tiles with buildings). */
  walkable: boolean;
  /** Whether this tile is within the player's fog-of-war vision radius. */
  visible: boolean;
  /** The ID of the building placed on this tile, or null if empty. */
  buildingId: string | null;
}

/** All building types defined in the game. */
export type BuildingType =
  | "TOWN_HALL"
  | "FORAGER_HUT"
  | "LUMBER_MILL"
  | "QUARRY"
  | "STOREHOUSE"
  | "FARM"
  | "LIBRARY"
  | "BARRACKS";

/**
 * The state of a placed building on the map.
 * Buildings are static after placement — they never move.
 */
export interface BuildingState {
  /** Unique identifier generated at placement time. */
  id: string;
  /** The building's functional type. */
  type: BuildingType;
  /** The tile ID where this building is anchored. */
  tileId: number;
  /** Building upgrade tier (1/2/3). */
  tier: 1 | 2 | 3;
  /** Whether the building has enough assigned workers to operate. */
  staffed: boolean;
  /** Whether the building is actively producing (requires staffed = true in MVP). */
  operational: boolean;
  /** IDs of workers currently assigned to this building. */
  assignedWorkerIds: string[];
}

/**
 * Worker agent states forming the state machine.
 * See PRD §14.3 for the full transition diagram.
 */
export type WorkerAgentState =
  | "IDLE"
  | "MOVING_TO_HARVEST"
  | "HARVESTING"
  | "MOVING_TO_DEPOSIT"
  | "DEPOSITING"
  | "WAITING"
  | "STARVING";

/** A single unit of resource carried by a worker. */
export interface ResourceUnit {
  type: ResourceType;
  amount: number;
}

/**
 * The full state of a single worker agent.
 * Workers are the only entities that move on the map.
 */
export interface WorkerState {
  /** Unique identifier generated at spawn time. */
  id: string;
  /** Current state machine state. */
  state: WorkerAgentState;
  /** The building this worker is assigned to harvest from, or null. */
  assignedBuildingId: string | null;
  /** Current tile position on the map grid. */
  position: TileCoordinate;
  /** Cached A* path, consumed front-to-back (one step per tick). */
  path: TileCoordinate[];
  /** Ticks spent in HARVESTING state towards the building's ticksToHarvest. */
  harvestTicks: number;
  /** Resource unit being carried to a deposit point, or null. */
  carrying: ResourceUnit | null;
}

/**
 * The complete client-side game state, serialised on save.
 * This is the shape sent to the server's SnapshotValidator.
 */
export interface GameState {
  /** Deterministic seed used to regenerate the map on load. */
  mapSeed: string;
  /** Total ticks elapsed — the simulation's sole time axis. */
  tickCount: number;
  /** Current era (1=Founding, 2=Settlement, 3=Fortification). */
  era: 1 | 2 | 3;
  /** Current resource totals, clamped to storage capacity. */
  resources: ResourcePool;
  /** Full tile grid state (80×80 = 6400 entries). */
  tiles: TileState[];
  /** All active worker agents. */
  workers: WorkerState[];
  /** All placed buildings. */
  buildings: BuildingState[];
  /** ISO timestamp of the last successful save, or null. */
  savedAt: string | null;
}

/**
 * Player actions queued from the UI and drained at tick Step 1.
 * See PRD §14.5 for validation rules per action type.
 */
export type PlayerAction =
  | { type: "PLACE_BUILDING"; buildingType: BuildingType; tileId: number }
  | { type: "DEMOLISH_BUILDING"; buildingId: string }
  | { type: "ASSIGN_WORKER"; workerId: string; buildingId: string }
  | { type: "UNASSIGN_WORKER"; workerId: string }
  | { type: "RESEARCH_ERA"; targetEra: 2 | 3 };

/**
 * Delta emitted from the Web Worker to the main thread each tick.
 * Contains only changed values — not a full state snapshot.
 */
export interface TickResult {
  type: "TICK_RESULT";
  tickCount: number;
  resourceTotals: ResourcePool;
  resourceDelta: ResourcePool;
  workerPositions: { id: string; tileId: number; state: WorkerAgentState }[];
  buildingUpdates: { id: string; staffed: boolean; operational: boolean }[];
  eraChanged: boolean;
  newEra?: 1 | 2 | 3;
  actionRejections: { action: PlayerAction; reason: string }[];
  /** Full worker state for UI sync (positions, carrying, assignments). */
  workers: WorkerState[];
  /** Full building state for UI sync. */
  buildings: BuildingState[];
  /** Updated tile ownership/visibility for rendering. */
  tiles: TileState[];
}

/** Messages sent from the main thread to the Web Worker. */
export type WorkerInbound =
  | { type: "INIT"; state: GameState }
  | { type: "PLAYER_ACTION"; action: PlayerAction }
  | { type: "PAUSE" }
  | { type: "RESUME" };

/** Messages sent from the Web Worker to the main thread. */
export type WorkerOutbound =
  | TickResult
  | { type: "READY" }
  | { type: "ACTION_REJECTED"; action: PlayerAction; reason: string };
