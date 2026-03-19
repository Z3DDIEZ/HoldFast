import { create } from "zustand";
import type {
  GameState,
  BuildingType,
  ResourcePool,
  BuildingState,
  UnitState as WorkerState,
  UnitType,
  CivilizationId,
  CivRuntimeState,
  TileState,
} from "../engine/tick-types";
import type { WorkerInbound, WorkerOutbound } from "../engine/tick-types";
import { getCivilization } from "../engine/civilizations";
import { CIVILIZATION_LIST } from "../engine/civilizations";
import {
  generateMultiStartMap,
  getCornerSpawns,
  MAP_WIDTH,
  expandTerritory,
} from "../engine/map-generator";
import { UNIT_CONFIG } from "../engine/building-config";

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
  NO_CIV_STATE: "Civilization state not found.",
};

let alertCounter = 0;

function formatActionRejection(reason: string): string {
  return ACTION_REJECTION_MESSAGES[reason] || `Action rejected: ${reason}`;
}

/** Extended game store combining engine state with UI-only fields. */
export interface GameStore {
  // --- Derived from player's CivRuntimeState ---
  era: 1 | 2 | 3 | 4;
  resources: ResourcePool;
  resourceDelta: ResourcePool;

  // --- Full game state ---
  mapSeed: string;
  tickCount: number;
  savedAt: string | null;
  tiles: TileState[];
  workers: WorkerState[];
  buildings: BuildingState[];

  // --- Multi-civ fields ---
  playerCivId: CivilizationId;
  activeCivs: CivilizationId[];
  civStates: Record<string, CivRuntimeState>;

  // --- UI state ---
  selectedBuilding: BuildingType | null;
  selectedBuildingId: string | null;
  saveStatus: "pending" | "synced" | "error";
  camera: CameraState;
  hoveredTileId: number | null;
  actionAlerts: ActionAlert[];
  simSpeed: number;
  isPaused: boolean;
  autoPlay: boolean;
  /** Whether the game has started (civ selected, engine initialized). */
  gameStarted: boolean;

  // Actions
  initEngine: (seed: string, playerCivId: CivilizationId) => void;
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
  researchEra: (targetEra: 2 | 3 | 4) => void;
  spawnWorker: () => void;
  spawnUnit: (buildingId: string, unitType: UnitType) => void;
  selectPlacedBuilding: (buildingId: string | null) => void;
  reRollMap: () => void;
  toggleAutoPlay: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
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
      case "TICK_RESULT": {
        const playerCivState = event.civStates[event.playerCivId];
        set({
          tickCount: event.tickCount,
          // Derive player-visible state from their CivRuntimeState
          resources: playerCivState ? { ...playerCivState.resources } : get().resources,
          resourceDelta: event.resourceDelta,
          era: playerCivState?.era || get().era,
          // Full state sync from worker
          workers: event.workers,
          buildings: event.buildings,
          tiles: event.tiles,
          civStates: event.civStates,
        });
        if (event.actionRejections.length > 0) {
          event.actionRejections.forEach((rejection) => {
            handleActionRejection(rejection.reason);
          });
        }
        break;
      }
      case "READY":
        console.log("[Holdfast] Engine Ready — Multi-Civ Mode");
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
    playerCivId: "franks",
    activeCivs: [],
    civStates: {},

    // UI state
    selectedBuilding: null,
    selectedBuildingId: null,
    hoveredTileId: null,
    actionAlerts: [],
    simSpeed: 1,
    isPaused: false,
    autoPlay: false,
    gameStarted: false,
    camera: {
      zoom: 1.0,
      offsetX: 0,
      offsetY: 0,
    },

    initEngine: (seed: string, playerCivId: CivilizationId) => {
      const allCivIds: CivilizationId[] = CIVILIZATION_LIST.map(c => c.id);
      const aiCivIds = allCivIds.filter(id => id !== playerCivId);
      const activeCivs: CivilizationId[] = [playerCivId, ...aiCivIds];

      // Assign corner spawn positions deterministically
      const corners = getCornerSpawns();

      // Generate map with habitable zones at each corner
      const tiles = generateMultiStartMap(seed, corners);

      // Create per-civ states and place Town Halls
      const civStates: Record<string, CivRuntimeState> = {};
      const buildings: BuildingState[] = [];
      const workers: WorkerState[] = [];

      activeCivs.forEach((civId, idx) => {
        const civ = getCivilization(civId);
        const spawn = corners[idx];
        const centerTileId = spawn.y * MAP_WIDTH + spawn.x;

        // Apply starting resources
        const civStarter = civ.bonuses.startingResources || {};
        const civResources: ResourcePool = {
          food: STARTER_RESOURCES.food + (civStarter.food || 0),
          wood: STARTER_RESOURCES.wood + (civStarter.wood || 0),
          stone: STARTER_RESOURCES.stone + (civStarter.stone || 0),
          knowledge: STARTER_RESOURCES.knowledge + (civStarter.knowledge || 0),
        };

        civStates[civId] = {
          civilizationId: civId,
          resources: civResources,
          era: 1,
          autoPlay: civId !== playerCivId, // AI civs always autoplay
          townHallTileId: centerTileId,
        };

        // Place Town Hall
        const townHall: BuildingState = {
          id: `b-${civId}-0-${centerTileId}`,
          ownerId: civId,
          type: "TOWN_HALL",
          tileId: centerTileId,
          tier: 1,
          constructionTicksRemaining: 0,
          constructionWorkerId: null,
          staffed: false,
          operational: false,
          assignedWorkerIds: [],
        };
        buildings.push(townHall);

        const tile = tiles[centerTileId];
        if (tile) {
          tile.buildingId = townHall.id;
          tile.walkable = true; // Workers can walk through buildings
        }

        // Expand territory around town hall
        expandTerritory(tiles, centerTileId, civId, 3, 5);

        // Spawn 3 initial workers
        const visionBoost = civ.bonuses.visionRadiusBoost || 0;
        for (let i = 0; i < 3; i++) {
          workers.push({
            id: `w-${civId}-0-${i}`,
            ownerId: civId,
            unitType: "WORKER",
            state: "IDLE",
            assignedBuildingId: null,
            position: { x: spawn.x, y: spawn.y },
            path: [],
            harvestTicks: 0,
            carrying: null,
            visionRadius: UNIT_CONFIG.WORKER.visionRadius + visionBoost,
          });
        }
      });

      // Camera: center on player's spawn position
      const playerSpawn = corners[0]; // Player is always first
      const playerCivState = civStates[playerCivId];

      set({
        mapSeed: seed,
        tiles,
        workers,
        buildings,
        resources: { ...playerCivState.resources },
        era: 1,
        playerCivId,
        activeCivs,
        civStates,
        tickCount: 0,
        gameStarted: true,
        autoPlay: false,
        // Center camera on player spawn (map is centered by default, so we just offset by the distance to spawn from center)
        camera: {
          zoom: 1.5,
          // Calculate offset in tile units from the center (MAP_WIDTH / 2), then convert to pixels at current scale
          offsetX: -((playerSpawn.x - MAP_WIDTH / 2) * 16 * 2 * 1.5),
          offsetY: -((playerSpawn.y - MAP_WIDTH / 2) * 16 * 2 * 1.5),
        },
      });

      const initialState: GameState = {
        mapSeed: seed,
        playerCivId,
        activeCivs,
        civStates,
        tickCount: 0,
        tiles,
        workers,
        buildings,
        savedAt: null,
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
      const allowed = [1, 2, 5, 10, 100, 1000, 10000];
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

    researchEra: (targetEra: 2 | 3 | 4) => {
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

    spawnUnit: (buildingId: string, unitType: UnitType) => {
      const cmd: WorkerInbound = {
        type: "PLAYER_ACTION",
        action: { type: "SPAWN_UNIT", buildingId, unitType },
      };
      worker.postMessage(cmd);
    },

    selectPlacedBuilding: (buildingId: string | null) => {
      set({ selectedBuildingId: buildingId });
    },

    updateCamera: (updates: Partial<CameraState>) => {
      set((state) => ({
        camera: { ...state.camera, ...updates },
      }));
    },

    setHoveredTile: (tileId: number | null) => {
      set({ hoveredTileId: tileId });
    },
    reRollMap: () => {
      const newSeed = `seed-${Math.random().toString(36).substring(2, 9)}`;
      get().initEngine(newSeed, get().playerCivId);
    },
    toggleAutoPlay: () => {
      const next = get().autoPlay;
      set({ autoPlay: !next });
      worker.postMessage({ type: "TOGGLE_AUTO_PLAY", enabled: !next });
    },
    zoomIn: () => {
      const current = get().camera.zoom;
      const next = Math.min(5.0, current * 1.2);
      get().updateCamera({ zoom: next });
    },
    zoomOut: () => {
      const current = get().camera.zoom;
      const next = Math.max(0.1, current / 1.2);
      get().updateCamera({ zoom: next });
    },
  };
});
