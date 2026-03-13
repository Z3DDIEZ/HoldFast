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

  // Actions
  initEngine: (seed: string) => void;
  pauseEngine: () => void;
  resumeEngine: () => void;
  selectBuilding: (type: BuildingType | null) => void;
  placeBuilding: (tileId: number) => void;
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
        break;
      case "READY":
        console.log("[Holdfast] Engine Ready");
        break;
      case "ACTION_REJECTED":
        console.warn("[Holdfast] Action Rejected:", event.reason, event.action);
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
