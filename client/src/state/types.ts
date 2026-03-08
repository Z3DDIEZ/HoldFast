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
import type { GameStore, CameraState } from "./game-store";

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
  GameStore,
  CameraState,
};
