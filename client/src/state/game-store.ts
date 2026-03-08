import { create } from "zustand";
import type { GameState } from "./types";
import type { WorkerCommand, WorkerEvent } from "../engine/tick-types";

export interface GameStore extends GameState {
  initEngine: (seed: string) => void;
  pauseEngine: () => void;
  resumeEngine: () => void;
}

const worker = new Worker(
  new URL("../engine/simulation.worker.ts", import.meta.url),
  {
    type: "module",
  },
);

export const useGameStore = create<GameStore>((set, get) => {
  // Listen for Worker messages
  worker.addEventListener("message", (e: MessageEvent<WorkerEvent>) => {
    const event = e.data;
    switch (event.type) {
      case "TICK":
        set((state) => ({ ...state, ...event.payload.deltaState }));
        break;
      case "MAP_GENERATED":
        set({ tiles: event.payload.tiles });
        break;
      case "ERROR":
        console.error("Worker Error:", event.payload.message);
        break;
    }
  });

  return {
    era: 1,
    resources: { food: 0, wood: 0, stone: 0, knowledge: 0 },
    tickCount: 0,
    saveStatus: "synced",
    lastSavedAt: null,
    mapSeed: "",
    tiles: [],
    workers: [],
    buildings: [],

    initEngine: (seed: string) => {
      set({ mapSeed: seed });
      const cmd: WorkerCommand = {
        type: "INIT",
        payload: { seed, tickCount: get().tickCount },
      };
      worker.postMessage(cmd);
    },

    pauseEngine: () => {
      const cmd: WorkerCommand = { type: "PAUSE" };
      worker.postMessage(cmd);
    },

    resumeEngine: () => {
      const cmd: WorkerCommand = { type: "RESUME" };
      worker.postMessage(cmd);
    },
  };
});
