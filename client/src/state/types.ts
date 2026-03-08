// NO Math.random() — simulation must be deterministic
import type {
  GameState as EngineGameState,
  TileState as EngineTileState,
  WorkerState as EngineWorkerState,
  BuildingState as EngineBuildingState,
  ResourceType,
  ResourcePool,
  TileType,
  BuildingType,
  WorkerAgentState,
  TileCoordinate,
} from "../engine/tick-types";

export type {
  EngineGameState as GameState,
  EngineTileState as TileState,
  EngineWorkerState as WorkerState,
  EngineBuildingState as BuildingState,
  ResourceType,
  ResourcePool,
  TileType,
  BuildingType,
  WorkerAgentState,
  TileCoordinate,
};
