export interface ResourcePool {
  food: number;
  wood: number;
  stone: number;
  knowledge: number;
}

export type TileType =
  | "grassland"
  | "forest"
  | "stone_deposit"
  | "water"
  | "barren";

export interface TileState {
  x: number;
  y: number;
  type: TileType;
  ownerId?: string; // Optional expansion boundary
  visible: boolean; // Fog of war
}

export interface WorkerTask {
  type: "idle" | "harvest" | "deposit" | "construct";
  targetId?: string; // Tile ID or Building ID
}

export interface WorkerState {
  id: string;
  x: number;
  y: number;
  currentTask: WorkerTask;
  taskQueue: WorkerTask[];
  path: { x: number; y: number }[];
  assignedBuildingId?: string;
}

export interface BuildingState {
  id: string;
  type: string;
  tier: number;
  x: number;
  y: number;
}

export interface GameState {
  mapSeed: string;
  tickCount: number;
  era: 1 | 2 | 3;
  resources: ResourcePool;
  tiles: TileState[];
  workers: WorkerState[];
  buildings: BuildingState[];
  saveStatus: "pending" | "synced" | "error";
  lastSavedAt: string | null;
}
