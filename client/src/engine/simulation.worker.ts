import type {
  GameState,
  ResourcePool,
  TileState,
  WorkerState,
  BuildingState,
} from "../state/types";
import type { WorkerCommand, WorkerEvent } from "./tick-types";
import { generateMap } from "./map-generator";
import { findPath } from "./pathfinder";

let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

let _tickCount = 0;
let _resources: ResourcePool = { food: 100, wood: 50, stone: 10, knowledge: 0 };
let _tiles: TileState[] = [];
let _workers: WorkerState[] = [];
let _buildings: BuildingState[] = [];
let _mapSeed = "";
let _era: 1 | 2 | 3 = 1;

const TICK_RATE_MS = 2000;
const MAP_SIZE = 80;

const ERA_REQUIREMENTS = {
  2: { knowledge: 100, buildings: 5 },
  3: { knowledge: 500, buildings: 15 },
};

function tick() {
  _tickCount++;

  // 1. Worker Movement & Task Execution
  for (const worker of _workers) {
    if (worker.path.length > 0) {
      // Move 1 tile per tick
      const nextPos = worker.path.shift()!;
      worker.x = nextPos.x;
      worker.y = nextPos.y;
    } else {
      // Reached destination, process task
      processWorkerTask(worker);
    }
  }

  // 2. Upkeep Logic
  const upkeep = _workers.length * 1; // 1 unit of food per worker
  _resources.food = Math.max(0, _resources.food - upkeep);

  // 3. Building Production
  processProduction();

  // 4. Era Progression Logic
  checkEraProgression();

  // Create a delta payload
  const delta: Partial<GameState> = {
    tickCount: _tickCount,
    era: _era,
    resources: { ..._resources },
    workers: [..._workers],
    buildings: [..._buildings],
  };

  emit({ type: "TICK", payload: { deltaState: delta } });
}

function checkEraProgression() {
  if (_era === 1) {
    if (
      _resources.knowledge >= ERA_REQUIREMENTS[2].knowledge &&
      _buildings.length >= ERA_REQUIREMENTS[2].buildings
    ) {
      _era = 2;
    }
  } else if (_era === 2) {
    if (
      _resources.knowledge >= ERA_REQUIREMENTS[3].knowledge &&
      _buildings.length >= ERA_REQUIREMENTS[3].buildings
    ) {
      _era = 3;
    }
  }
}

function processWorkerTask(worker: WorkerState) {
  const task = worker.currentTask;

  if (task.type === "idle") {
    if (worker.taskQueue.length > 0) {
      worker.currentTask = worker.taskQueue.shift()!;
      setWorkerPath(worker);
    } else if (Math.random() > 0.8) {
      // Small random walk for ambient life
      const tx = Math.floor(Math.random() * 7) - 3 + worker.x;
      const ty = Math.floor(Math.random() * 7) - 3 + worker.y;
      const clampedX = Math.max(0, Math.min(MAP_SIZE - 1, tx));
      const clampedY = Math.max(0, Math.min(MAP_SIZE - 1, ty));

      const tile = _tiles[clampedY * MAP_SIZE + clampedX];
      if (tile && tile.type !== "water") {
        worker.path = findPath(worker.x, worker.y, clampedX, clampedY, _tiles);
      }
    }
  } else {
    worker.currentTask = { type: "idle" };
  }
}

function setWorkerPath(_worker: WorkerState) {
  // Expansion boundary for Phase 2: Specific target pathfinding
}

function processProduction() {
  for (const building of _buildings) {
    if (building.type === "town_hall") {
      _resources.food += 1;
    } else if (building.type === "forager_hut") {
      _resources.food += 3;
    } else if (building.type === "lumber_mill") {
      _resources.wood += 2;
    } else if (building.type === "quarry") {
      _resources.stone += 1;
    } else if (building.type === "library") {
      _resources.knowledge += 5;
    } else if (building.type === "farm") {
      _resources.food += 8;
    }
  }
}

function handleCommand(cmd: WorkerCommand) {
  switch (cmd.type) {
    case "INIT":
      _tickCount = cmd.payload.tickCount;
      _mapSeed = cmd.payload.seed;
      _tiles = generateMap(_mapSeed);

      if (_buildings.length === 0) {
        _buildings = [{ id: "th-1", type: "town_hall", tier: 1, x: 40, y: 40 }];
      }
      if (_workers.length === 0) {
        _workers = [
          {
            id: "w-1",
            x: 40,
            y: 41,
            currentTask: { type: "idle" },
            taskQueue: [],
            path: [],
          },
          {
            id: "w-2",
            x: 41,
            y: 40,
            currentTask: { type: "idle" },
            taskQueue: [],
            path: [],
          },
        ];
      }

      emit({ type: "MAP_GENERATED", payload: { tiles: _tiles } });

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
      const { buildingType, x, y } = cmd.payload;

      // Basic cost validation for Phase 1 depth
      const costs: Record<string, Partial<ResourcePool>> = {
        forager_hut: { wood: 10 },
        lumber_mill: { wood: 20 },
        quarry: { wood: 15, stone: 5 },
        library: { wood: 30, stone: 20 },
        farm: { wood: 40, stone: 10 },
      };

      const cost = costs[buildingType] || {};
      if (
        _resources.wood >= (cost.wood || 0) &&
        _resources.stone >= (cost.stone || 0)
      ) {
        _resources.wood -= cost.wood || 0;
        _resources.stone -= cost.stone || 0;

        _buildings.push({
          id: `b-${Date.now()}`,
          type: buildingType,
          tier: 1,
          x,
          y,
        });

        // Spawn a new worker from town hall every few buildings
        if (_buildings.length % 3 === 0) {
          _workers.push({
            id: `w-${_workers.length + 1}`,
            x: 40,
            y: 40,
            currentTask: { type: "idle" },
            taskQueue: [],
            path: [],
          });
        }
      }
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
