import type { GameState } from "../state/types";

// Messages strictly emitted from Main Thread -> Worker
export type WorkerCommand =
  | { type: "INIT"; payload: { seed: string; tickCount: number } }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | {
      type: "PLACE_BUILDING";
      payload: { buildingType: string; x: number; y: number };
    };

// Messages strictly emitted from Worker -> Main Thread
export type WorkerEvent =
  | { type: "TICK"; payload: { deltaState: Partial<GameState> } }
  | { type: "MAP_GENERATED"; payload: { tiles: GameState["tiles"] } }
  | { type: "ERROR"; payload: { message: string } };
