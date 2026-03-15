import type {
  GameState as EngineGameState,
  TileState as EngineTileState,
  UnitState as EngineUnitState,
  BuildingState as EngineBuildingState,
  ResourceType,
  ResourcePool,
  TileType,
  BuildingType,
  WorkerAgentState,
  TileCoordinate,
  ResourceUnit,
} from "../engine/tick-types";
import type { GameStore, CameraState } from "./game-store";

export type {
  EngineGameState as GameState,
  EngineTileState as TileState,
  EngineUnitState as UnitState,
  EngineBuildingState as BuildingState,
  ResourceType,
  ResourcePool,
  TileType,
  BuildingType,
  WorkerAgentState,
  TileCoordinate,
  ResourceUnit,
  GameStore,
  CameraState,
};
