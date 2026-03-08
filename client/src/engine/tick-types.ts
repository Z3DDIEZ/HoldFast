// NO Math.random() — simulation must be deterministic

export type ResourceType = "food" | "wood" | "stone" | "knowledge";

export interface ResourcePool {
  food: number;
  wood: number;
  stone: number;
  knowledge: number;
}

export type TileType =
  | "GRASSLAND"
  | "FOREST"
  | "STONE_DEPOSIT"
  | "WATER"
  | "BARREN";

export interface TileCoordinate {
  x: number;
  y: number;
}

export interface TileState {
  id: number; // row * MAP_WIDTH + col
  type: TileType;
  owned: boolean;
  walkable: boolean;
  buildingId: string | null;
}

export type BuildingType =
  | "TOWN_HALL"
  | "FORAGER_HUT"
  | "LUMBER_MILL"
  | "QUARRY"
  | "STOREHOUSE"
  | "FARM"
  | "LIBRARY"
  | "BARRACKS";

export interface BuildingState {
  id: string;
  type: BuildingType;
  tileId: number;
  tier: 1 | 2 | 3;
  staffed: boolean;
  operational: boolean;
  assignedWorkerIds: string[];
}

export type WorkerAgentState =
  | "IDLE"
  | "MOVING_TO_HARVEST"
  | "HARVESTING"
  | "MOVING_TO_DEPOSIT"
  | "DEPOSITING"
  | "WAITING"
  | "STARVING";

export interface ResourceUnit {
  type: ResourceType;
  amount: number;
}

export interface WorkerState {
  id: string;
  state: WorkerAgentState;
  assignedBuildingId: string | null;
  position: TileCoordinate;
  path: TileCoordinate[];
  harvestTicks: number;
  carrying: ResourceUnit | null;
}

export interface GameState {
  mapSeed: string;
  tickCount: number;
  era: 1 | 2 | 3;
  resources: ResourcePool;
  tiles: TileState[];
  workers: WorkerState[];
  buildings: BuildingState[];
  savedAt: string | null;
}

export type PlayerAction =
  | { type: "PLACE_BUILDING"; buildingType: BuildingType; tileId: number }
  | { type: "DEMOLISH_BUILDING"; buildingId: string }
  | { type: "ASSIGN_WORKER"; workerId: string; buildingId: string }
  | { type: "UNASSIGN_WORKER"; workerId: string }
  | { type: "RESEARCH_ERA"; targetEra: 2 | 3 };

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
}

export type WorkerInbound =
  | { type: "INIT"; state: GameState }
  | { type: "PLAYER_ACTION"; action: PlayerAction }
  | { type: "PAUSE" }
  | { type: "RESUME" };

export type WorkerOutbound =
  | TickResult
  | { type: "READY" }
  | { type: "ACTION_REJECTED"; action: PlayerAction; reason: string };
