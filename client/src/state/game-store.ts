import { create } from "zustand";
import type {
  GameState,
  BuildingType,
  ResourcePool,
} from "../engine/tick-types";
import type { WorkerInbound, WorkerOutbound } from "../engine/tick-types";
import { generateMap } from "../engine/map-generator";

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
  BUILDING_NOT_ASSIGNABLE: "Building cannot take workers.",
  BUILDING_FULLY_STAFFED: "Building is fully staffed.",
  NOT_ASSIGNED: "Worker is not assigned.",
  INVALID_ERA_ORDER: "Era transition invalid.",
  INSUFFICIENT_KNOWLEDGE: "Not enough knowledge.",
  INSUFFICIENT_POPULATION: "Not enough workers.",
  INSUFFICIENT_FOOD: "Not enough food to spawn a worker.",
  TOWN_HALL_MISSING: "Town Hall required.",
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

  // Actions
  initEngine: (seed: string) => void;
  pauseEngine: () => void;
  resumeEngine: () => void;
  selectBuilding: (type: BuildingType | null) => void;
  placeBuilding: (tileId: number) => void;
  demolishBuilding: (buildingId: string) => void;
  updateCamera: (updates: Partial<CameraState>) => void;
  setHoveredTile: (tileId: number | null) => void;
  assignWorker: (workerId: string, buildingId: string) => void;
  unassignWorker: (workerId: string) => void;
  researchEra: (targetEra: 2 | 3) => void;
  spawnWorker: () => void;
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
      set({ mapSeed: seed, tiles: initialTiles });

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
      };

      const cmd: WorkerInbound = { type: "INIT", state: initialState };
      worker.postMessage(cmd);
    },

    pauseEngine: () => {
      const cmd: WorkerInbound = { type: "PAUSE" };
      worker.postMessage(cmd);
    },

    resumeEngine: () => {
      const cmd: WorkerInbound = { type: "RESUME" };
      worker.postMessage(cmd);
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
  };
});
