import type { GameState, ResourcePool } from "../state/types";
import type { WorkerCommand, WorkerEvent } from "./tick-types";
import { generateMap } from "./map-generator";

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

let _tickCount = 0;
let _resources: ResourcePool = { food: 0, wood: 0, stone: 0, knowledge: 0 };

const TICK_RATE_MS = 2000;

function tick() {
  _tickCount++;

  // MVP Phase 1: naive accumulation for testing the loop
  _resources.food += 2;
  _resources.wood += 1;
  if (_tickCount % 5 === 0) {
    _resources.knowledge += 1;
  }

  // Create a delta payload
  const delta: Partial<GameState> = {
    tickCount: _tickCount,
    resources: { ..._resources },
  };

  emit({ type: "TICK", payload: { deltaState: delta } });
}

function handleCommand(cmd: WorkerCommand) {
  switch (cmd.type) {
    case "INIT":
      _tickCount = cmd.payload.tickCount;
      const initialMap = generateMap(cmd.payload.seed);
      emit({ type: "MAP_GENERATED", payload: { tiles: initialMap } });

      if (!isRunning) {
        isRunning = true;
        intervalId = setInterval(tick, TICK_RATE_MS);
      }
      break;

    case "PAUSE":
      if (isRunning && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
      }
      break;

    case "RESUME":
      if (!isRunning) {
        isRunning = true;
        intervalId = setInterval(tick, TICK_RATE_MS);
      }
      break;

    case "PLACE_BUILDING":
      // Handled in Phase 2
      break;
  }
}

function emit(event: WorkerEvent) {
  self.postMessage(event);
}

self.addEventListener("message", (e: MessageEvent<WorkerCommand>) => {
  try {
    handleCommand(e.data);
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : "Unknown error";
    emit({ type: "ERROR", payload: { message: errorMsg } });
  }
});
