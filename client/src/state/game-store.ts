import { create } from "zustand";
import type { GameState, BuildingType } from "./types";
import type { WorkerInbound, WorkerOutbound } from "../engine/tick-types";
import { generateMap } from "../engine/map-generator";

export interface GameStore extends GameState {
  selectedBuilding: BuildingType | null;
  saveStatus: "pending" | "synced" | "error"; // UI-only field
  initEngine: (seed: string) => void;
  pauseEngine: () => void;
  resumeEngine: () => void;
  selectBuilding: (type: BuildingType | null) => void;
  placeBuilding: (tileId: number) => void;
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
        set((state) => ({
          ...state,
          tickCount: event.tickCount,
          resources: event.resourceTotals,
          era: event.newEra || state.era,
          // Note: In a full implementation, we'd update workers/buildings lists properly
          // For now, these are updated via the full TICK_RESULT if we want.
          // The PRD says it emits TickResult.
        }));
        break;
      case "READY":
        console.log("Engine Ready");
        break;
      case "ACTION_REJECTED":
        console.error("Action Rejected:", event.reason, event.action);
        break;
    }
  });

  return {
    era: 1,
    resources: { food: 0, wood: 0, stone: 0, knowledge: 0 },
    tickCount: 0,
    saveStatus: "synced",
    savedAt: null,
    mapSeed: "",
    tiles: [],
    workers: [],
    buildings: [],
    selectedBuilding: null,

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

      const cmd: WorkerInbound = {
        type: "INIT",
        state: initialState,
      };
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
  };
});
