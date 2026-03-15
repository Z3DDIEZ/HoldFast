import { create } from "zustand";
import type {
  GameState,
  BuildingType,
  ResourcePool,
  BuildingState,
  WorkerState,
} from "../engine/tick-types";
import type { WorkerInbound, WorkerOutbound } from "../engine/tick-types";
import {
  generateMap,
  CENTER_X,
  CENTER_Y,
  MAP_WIDTH,
  expandTerritory,
} from "../engine/map-generator";

/** Camera pan/zoom state for the canvas renderer. */
export interface CameraState {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

interface ActionAlert {
  id: string;
  message: string;
}

const STARTER_RESOURCES: ResourcePool = {
  food: 30,
  wood: 35,
  stone: 5,
  knowledge: 0,
};

const ACTION_REJECTION_MESSAGES: Record<string, string> = {
  TILE_NOT_FOUND: "Tile not found.",
  TILE_INVALID: "Cannot place building on that tile.",
  UNKNOWN_BUILDING_TYPE: "Unknown building type.",
  ERA_LOCKED: "Building locked by era.",
  TOWN_HALL_EXISTS: "Only one Town Hall can be placed.",
  MISSING_ADJACENT_BIOME: "Missing required adjacent biome.",
  INSUFFICIENT_RESOURCES: "Not enough resources.",
  BUILDING_NOT_FOUND: "Building not found.",
  CANNOT_DEMOLISH_TOWN_HALL: "Town Hall cannot be demolished.",
  INVALID_TARGETS: "Invalid worker or building.",
  WORKER_ALREADY_ASSIGNED: "Worker already assigned.",
  BUILDING_UNDER_CONSTRUCTION: "Building is still under construction.",
  BUILDING_NOT_ASSIGNABLE: "Building cannot take workers.",
  BUILDING_FULLY_STAFFED: "Building is fully staffed.",
  NOT_ASSIGNED: "Worker is not assigned.",
  INVALID_ERA_ORDER: "Era transition invalid.",
  INSUFFICIENT_KNOWLEDGE: "Not enough knowledge.",
  INSUFFICIENT_POPULATION: "Not enough workers.",
  INSUFFICIENT_FOOD: "Not enough food to spawn a worker.",
  INSUFFICIENT_HOUSING: "Not enough housing capacity.",
  TOWN_HALL_MISSING: "Town Hall required.",
  HOUSING_WOULD_BE_EXCEEDED: "Cannot remove housing with current population.",
  UNKNOWN_ACTION: "Unknown action.",
  NO_STATE: "Simulation not ready.",
};

let alertCounter = 0;

function formatActionRejection(reason: string): string {
  return ACTION_REJECTION_MESSAGES[reason] || `Action rejected: ${reason}`;
}

/** Extended game store combining engine state with UI-only fields. */
export interface GameStore extends GameState {
  /** Currently selected building type for placement, or null. */
  selectedBuilding: BuildingType | null;
  /** Save operation status for the SaveStatusIndicator. */
  saveStatus: "pending" | "synced" | "error";
  /** Camera pan/zoom state. */
  camera: CameraState;
  /** Last tick's per-resource delta for ResourceBar +/- indicators. */
  resourceDelta: ResourcePool;
  /** Tile ID currently under the mouse cursor, or null. */
  hoveredTileId: number | null;
  /** Action rejection alerts surfaced to the UI. */
  actionAlerts: ActionAlert[];
  /** Current simulation speed multiplier (1x, 2x, 5x, 10x, 100x). */
  simSpeed: number;
  /** Whether the simulation is currently paused. */
  isPaused: boolean;
  /** Whether Auto-Play is enabled. */
  autoPlay: boolean;

  // Actions
  initEngine: (seed: string) => void;
  pauseEngine: () => void;
  resumeEngine: () => void;
  togglePause: () => void;
  selectBuilding: (type: BuildingType | null) => void;
  placeBuilding: (tileId: number) => void;
  demolishBuilding: (buildingId: string) => void;
  setSimSpeed: (multiplier: number) => void;
  updateCamera: (updates: Partial<CameraState>) => void;
  setHoveredTile: (tileId: number | null) => void;
  assignWorker: (workerId: string, buildingId: string) => void;
  unassignWorker: (workerId: string) => void;
  researchEra: (targetEra: 2 | 3) => void;
  spawnWorker: () => void;
  toggleAutoPlay: () => void;
}

const worker = new Worker(
  new URL("../engine/simulation.worker.ts", import.meta.url),
  {
    type: "module",
  },
);

export const useGameStore = create<GameStore>((set, get) => {
  const pushActionAlert = (message: string) => {
    const id = `alert-${Date.now()}-${alertCounter++}`;
    set((state) => ({
      actionAlerts: [...state.actionAlerts, { id, message }].slice(-3),
    }));

    setTimeout(() => {
      set((state) => ({
        actionAlerts: state.actionAlerts.filter((alert) => alert.id !== id),
      }));
    }, 3500);
  };

  const handleActionRejection = (reason: string) => {
    pushActionAlert(formatActionRejection(reason));
  };

  // Listen for Worker messages
  worker.addEventListener("message", (e: MessageEvent<WorkerOutbound>) => {
    const event = e.data;
    switch (event.type) {
      case "TICK_RESULT":
        set({
          tickCount: event.tickCount,
          resources: event.resourceTotals,
          resourceDelta: event.resourceDelta,
          era: event.newEra || get().era,
          // Full state sync from worker
          workers: event.workers,
          buildings: event.buildings,
          tiles: event.tiles,
        });
        if (event.actionRejections.length > 0) {
          event.actionRejections.forEach((rejection) => {
            handleActionRejection(rejection.reason);
          });
        }
        break;
      case "READY":
        console.log("[Holdfast] Engine Ready");
        break;
      case "ACTION_REJECTED":
        console.warn("[Holdfast] Action Rejected:", event.reason, event.action);
        handleActionRejection(event.reason);
        break;
    }
  });

  return {
    // Game state
    era: 1,
    resources: { food: 0, wood: 0, stone: 0, knowledge: 0 },
    resourceDelta: { food: 0, wood: 0, stone: 0, knowledge: 0 },
    tickCount: 0,
    saveStatus: "synced",
    savedAt: null,
    mapSeed: "",
    tiles: [],
    workers: [],
    buildings: [],

    // UI state
    selectedBuilding: null,
    hoveredTileId: null,
    actionAlerts: [],
    simSpeed: 1,
    isPaused: false,
    autoPlay: false,
    camera: {
      zoom: 1.0,
      offsetX: 0,
      offsetY: 0,
    },

    initEngine: (seed: string) => {
      let initialTiles = get().tiles;
      if (initialTiles.length === 0) {
        initialTiles = generateMap(seed);
      }

      let initialWorkers: WorkerState[] = [...get().workers];
      let initialBuildings: BuildingState[] = [...get().buildings];
      let initialResources: ResourcePool = { ...get().resources };

      if (initialBuildings.length === 0 && initialWorkers.length === 0) {
        const centerTileId = CENTER_Y * MAP_WIDTH + CENTER_X;
        const centerTile = initialTiles[centerTileId];

        if (centerTile && !centerTile.buildingId) {
          const townHall: BuildingState = {
            id: `b-0-${centerTileId}`,
            type: "TOWN_HALL",
            tileId: centerTileId,
            tier: 1,
            constructionTicksRemaining: 0,
            constructionWorkerId: null,
            staffed: false,
            operational: false,
            assignedWorkerIds: [],
          };

          initialBuildings = [townHall];
          centerTile.buildingId = townHall.id;
          centerTile.walkable = false;
          expandTerritory(initialTiles, centerTileId, 3, 5);

          initialWorkers = Array.from({ length: 3 }).map((_, i) => ({
            id: `w-0-${i}`,
            state: "IDLE",
            assignedBuildingId: null,
            position: { x: CENTER_X, y: CENTER_Y },
            path: [],
            harvestTicks: 0,
            carrying: null,
          }));

          initialResources = {
            food: Math.max(initialResources.food, STARTER_RESOURCES.food),
            wood: Math.max(initialResources.wood, STARTER_RESOURCES.wood),
            stone: Math.max(initialResources.stone, STARTER_RESOURCES.stone),
            knowledge: Math.max(
              initialResources.knowledge,
              STARTER_RESOURCES.knowledge,
            ),
          };
        }
      }

      set({
        mapSeed: seed,
        tiles: initialTiles,
        workers: initialWorkers,
        buildings: initialBuildings,
        resources: initialResources,
      });

      const {
        mapSeed,
        tickCount,
        era,
        resources,
        tiles,
        workers,
        buildings,
        savedAt,
      } = get();
      const initialState: GameState = {
        mapSeed,
        tickCount,
        era,
        resources,
        tiles,
        workers,
        buildings,
        savedAt,
        autoPlay: get().autoPlay,
      };

      const cmd: WorkerInbound = { type: "INIT", state: initialState };
      worker.postMessage(cmd);
    },

    pauseEngine: () => {
      const cmd: WorkerInbound = { type: "PAUSE" };
      worker.postMessage(cmd);
      set({ isPaused: true });
    },

    resumeEngine: () => {
      const cmd: WorkerInbound = { type: "RESUME" };
      worker.postMessage(cmd);
      set({ isPaused: false });
    },

    togglePause: () => {
      const paused = get().isPaused;
      if (paused) {
        const cmd: WorkerInbound = { type: "RESUME" };
        worker.postMessage(cmd);
        set({ isPaused: false });
      } else {
        const cmd: WorkerInbound = { type: "PAUSE" };
        worker.postMessage(cmd);
        set({ isPaused: true });
      }
    },

    selectBuilding: (type: BuildingType | null) => {
      set({ selectedBuilding: type });
    },

    placeBuilding: (tileId: number) => {
      const buildingType = get().selectedBuilding;
      if (!buildingType) return;

      const cmd: WorkerInbound = {
        type: "PLAYER_ACTION",
        action: { type: "PLACE_BUILDING", buildingType, tileId },
      };
      worker.postMessage(cmd);
      set({ selectedBuilding: null });
    },

    demolishBuilding: (buildingId: string) => {
      const cmd: WorkerInbound = {
        type: "PLAYER_ACTION",
        action: { type: "DEMOLISH_BUILDING", buildingId },
      };
      worker.postMessage(cmd);
    },

    setSimSpeed: (multiplier: number) => {
      const allowed = [1, 2, 5, 10, 100];
      const nextSpeed = allowed.includes(multiplier) ? multiplier : 1;
      set({ simSpeed: nextSpeed });
      const cmd: WorkerInbound = { type: "SET_SPEED", multiplier: nextSpeed };
      worker.postMessage(cmd);
    },

    assignWorker: (workerId: string, buildingId: string) => {
      const cmd: WorkerInbound = {
        type: "PLAYER_ACTION",
        action: { type: "ASSIGN_WORKER", workerId, buildingId },
      };
      worker.postMessage(cmd);
    },

    unassignWorker: (workerId: string) => {
      const cmd: WorkerInbound = {
        type: "PLAYER_ACTION",
        action: { type: "UNASSIGN_WORKER", workerId },
      };
      worker.postMessage(cmd);
    },

    researchEra: (targetEra: 2 | 3) => {
      const cmd: WorkerInbound = {
        type: "PLAYER_ACTION",
        action: { type: "RESEARCH_ERA", targetEra },
      };
      worker.postMessage(cmd);
    },

    spawnWorker: () => {
      const cmd: WorkerInbound = {
        type: "PLAYER_ACTION",
        action: { type: "SPAWN_WORKER" },
      };
      worker.postMessage(cmd);
    },

    updateCamera: (updates: Partial<CameraState>) => {
      set((state) => ({
        camera: { ...state.camera, ...updates },
      }));
    },

    setHoveredTile: (tileId: number | null) => {
      set({ hoveredTileId: tileId });
    },
    toggleAutoPlay: () => {
      const next = get().autoPlay;
      set({ autoPlay: !next });
      worker.postMessage({ type: "TOGGLE_AUTO_PLAY", enabled: !next });
    },
  };
});
