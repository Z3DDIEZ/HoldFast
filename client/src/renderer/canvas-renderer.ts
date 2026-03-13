import type { GameStore, CameraState } from "../state/game-store";
import type {
  TileState,
  BuildingState,
  WorkerState,
  ResourcePool,
  TileType,
  BuildingType,
} from "../state/types";
import { tileIdToCoord } from "../engine/pathfinder";
import { MAP_WIDTH } from "../engine/map-generator";
import { BUILDING_CONFIG } from "../engine/building-config";

/** Logical tile size before scaling. */
const TILE_SIZE = 16;
/** Default canvas scale (2× for pixel-art crispness). */
const BASE_SCALE = 2;

/** Tile colour palette from PRD §13. */
const TILE_COLORS: Record<
  string,
  { base: string; accent: string; border: string; fog: string }
> = {
  GRASSLAND: {
    base: "#4a7c3f",
    accent: "#6aaf55",
    border: "#3a5e30",
    fog: "#1a2e1a",
  },
  FOREST: {
    base: "#2d5a1b",
    accent: "#3d7a25",
    border: "#1e3d12",
    fog: "#0f1e09",
  },
  STONE_DEPOSIT: {
    base: "#7a7a6e",
    accent: "#9a9a8e",
    border: "#5a5a50",
    fog: "#1e1e1c",
  },
  WATER: {
    base: "#2a5f8f",
    accent: "#3a7fbf",
    border: "#1a3f6f",
    fog: "#0d1f38",
  },
  BARREN: {
    base: "#8f7a5a",
    accent: "#a89060",
    border: "#6f5a3a",
    fog: "#2a1e0f",
  },
};

/** Per-type building colours for distinct visuals. */
const BUILDING_COLORS: Record<string, { fill: string; border: string }> = {
  TOWN_HALL: { fill: "#c8a020", border: "#a08018" },
  FORAGER_HUT: { fill: "#6aaf55", border: "#4a8f3f" },
  LUMBER_MILL: { fill: "#8b6914", border: "#6b4910" },
  QUARRY: { fill: "#909090", border: "#707070" },
  STOREHOUSE: { fill: "#c8b888", border: "#a89868" },
  FARM: { fill: "#4a8f3f", border: "#3a6f2f" },
  LIBRARY: { fill: "#6a60c0", border: "#4a40a0" },
  BARRACKS: { fill: "#c04040", border: "#a02020" },
};

/** Short labels for building types. */
const BUILDING_LABELS: Record<string, string> = {
  TOWN_HALL: "TH",
  FORAGER_HUT: "FH",
  LUMBER_MILL: "LM",
  QUARRY: "QR",
  STOREHOUSE: "ST",
  FARM: "FM",
  LIBRARY: "LB",
  BARRACKS: "BK",
};

const ADJACENT_BIOME_REQUIREMENTS: Partial<Record<BuildingType, TileType>> = {
  FORAGER_HUT: "GRASSLAND",
  LUMBER_MILL: "FOREST",
  QUARRY: "STONE_DEPOSIT",
};

/** Worker colours per state. */
const WORKER_STATE_COLORS: Record<string, string> = {
  IDLE: "#ffffff",
  MOVING_TO_CONSTRUCT: "#c8a020",
  CONSTRUCTING: "#c8a020",
  MOVING_TO_HARVEST: "#40d0d0",
  HARVESTING: "#c8a020",
  MOVING_TO_DEPOSIT: "#40d0d0",
  DEPOSITING: "#4aaf4a",
  WAITING: "#c8a020",
  STARVING: "#ff5555",
};

/** Background/fog colour. */
const BG_COLOR = "#0a0a0a";

/**
 * Canvas 2D renderer for the HoldFast game map.
 * Handles tile grid, fog-of-war, buildings, workers, owned territory,
 * and selection highlights. Crisp pixel-art via imageSmoothingEnabled=false.
 */
export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private tiles: TileState[] = [];
  private buildings: BuildingState[] = [];
  private workers: WorkerState[] = [];
  private era = 1;
  private resources: ResourcePool = {
    food: 0,
    wood: 0,
    stone: 0,
    knowledge: 0,
  };
  private camera: CameraState = { zoom: 1, offsetX: 0, offsetY: 0 };
  private selectedBuilding: string | null = null;
  private hoveredTileId: number | null = null;
  private animFrame: number = 0;

  // Computed values
  private currentTileSize = TILE_SIZE * BASE_SCALE;
  private cameraX = 0;
  private cameraY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not initialize 2D context");
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    window.addEventListener("resize", this.handleResize);
    this.handleResize();
    requestAnimationFrame(this.renderLoop);
  }

  private handleResize = () => {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.ctx.imageSmoothingEnabled = false;
  };

  /** Update state from the Zustand store for next render. */
  public updateState(store: GameStore, camera: CameraState) {
    this.tiles = store.tiles;
    this.buildings = store.buildings;
    this.workers = store.workers;
    this.era = store.era;
    this.resources = store.resources;
    this.camera = camera;
    this.selectedBuilding = store.selectedBuilding;
    this.hoveredTileId = store.hoveredTileId;
    this.currentTileSize = TILE_SIZE * BASE_SCALE * camera.zoom;
  }

  /** Convert screen coordinates to a tile ID, or null if out of bounds. */
  public screenToTileId(screenX: number, screenY: number): number | null {
    const tx = Math.floor(
      (screenX - this.cameraX - this.camera.offsetX) / this.currentTileSize,
    );
    const ty = Math.floor(
      (screenY - this.cameraY - this.camera.offsetY) / this.currentTileSize,
    );

    if (tx >= 0 && tx < MAP_WIDTH && ty >= 0 && ty < MAP_WIDTH) {
      return ty * MAP_WIDTH + tx;
    }
    return null;
  }

  private canAfford(cost: Partial<ResourcePool>): boolean {
    for (const [key, amount] of Object.entries(cost)) {
      if (this.resources[key as keyof ResourcePool] < (amount || 0)) {
        return false;
      }
    }
    return true;
  }

  private hasAdjacentBiome(tileId: number, required: TileType): boolean {
    const coord = tileIdToCoord(tileId);
    const neighbors = [
      { x: coord.x, y: coord.y - 1 },
      { x: coord.x, y: coord.y + 1 },
      { x: coord.x - 1, y: coord.y },
      { x: coord.x + 1, y: coord.y },
    ];

    for (const n of neighbors) {
      if (n.x < 0 || n.x >= MAP_WIDTH || n.y < 0 || n.y >= MAP_WIDTH) {
        continue;
      }
      const nId = n.y * MAP_WIDTH + n.x;
      if (this.tiles[nId]?.type === required) {
        return true;
      }
    }

    return false;
  }

  private isPlacementValid(
    tileId: number,
    buildingType: string | null,
  ): boolean {
    if (!buildingType) return false;
    const tile = this.tiles[tileId];
    if (!tile || !tile.owned || !tile.walkable || tile.buildingId) {
      return false;
    }

    const config = BUILDING_CONFIG[buildingType as BuildingType];
    if (!config) return false;
    if (this.era < config.requiredEra) return false;
    if (!this.canAfford(config.cost)) return false;

    if (
      buildingType === "TOWN_HALL" &&
      this.buildings.some((b) => b.type === "TOWN_HALL")
    ) {
      return false;
    }

    const requiredBiome =
      ADJACENT_BIOME_REQUIREMENTS[buildingType as BuildingType];
    if (requiredBiome && !this.hasAdjacentBiome(tileId, requiredBiome)) {
      return false;
    }

    return true;
  }

  /** Clean up event listeners. */
  public cleanup() {
    window.removeEventListener("resize", this.handleResize);
  }

  private renderLoop = () => {
    this.animFrame++;
    this.render();
    requestAnimationFrame(this.renderLoop);
  };

  private render() {
    const { ctx, canvas } = this;

    // Clear with dark background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!this.tiles || this.tiles.length === 0) return;

    const mapWidthPx = MAP_WIDTH * this.currentTileSize;
    const mapHeightPx = MAP_WIDTH * this.currentTileSize;

    // Center the map in the viewport
    this.cameraX = (canvas.width - mapWidthPx) / 2;
    this.cameraY = (canvas.height - mapHeightPx) / 2;

    const totalX = this.cameraX + this.camera.offsetX;
    const totalY = this.cameraY + this.camera.offsetY;

    // ─── Tiles ───
    for (const tile of this.tiles) {
      const coord = tileIdToCoord(tile.id);
      const px = totalX + coord.x * this.currentTileSize;
      const py = totalY + coord.y * this.currentTileSize;

      // Frustum culling
      if (
        px + this.currentTileSize < 0 ||
        px > canvas.width ||
        py + this.currentTileSize < 0 ||
        py > canvas.height
      ) {
        continue;
      }

      const colors = TILE_COLORS[tile.type] || TILE_COLORS.BARREN;

      if (!tile.visible) {
        // Fog-of-war: render using the tile's fog colour
        ctx.fillStyle = colors.fog;
        ctx.fillRect(px, py, this.currentTileSize, this.currentTileSize);
        continue;
      }

      // Base tile colour
      ctx.fillStyle = colors.base;
      ctx.fillRect(px, py, this.currentTileSize, this.currentTileSize);

      // Owned territory tint — white overlay at 10% opacity
      if (tile.owned) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
        ctx.fillRect(px, py, this.currentTileSize, this.currentTileSize);
      }

      // Tile borders (only when zoomed in enough)
      if (this.camera.zoom > 0.4) {
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.strokeRect(px, py, this.currentTileSize, this.currentTileSize);
      }
    }

    // ─── Buildings ───
    for (const building of this.buildings) {
      const coord = tileIdToCoord(building.tileId);
      const px = totalX + coord.x * this.currentTileSize;
      const py = totalY + coord.y * this.currentTileSize;

      // Frustum culling
      if (
        px + this.currentTileSize < 0 ||
        px > canvas.width ||
        py + this.currentTileSize < 0 ||
        py > canvas.height
      ) {
        continue;
      }

      const bColors = BUILDING_COLORS[building.type] || {
        fill: "#888888",
        border: "#666666",
      };
      const inset = Math.max(2, this.currentTileSize * 0.1);

      // Building fill
      const isUnderConstruction = building.constructionTicksRemaining > 0;
      ctx.fillStyle = isUnderConstruction
        ? `${bColors.fill}55`
        : building.operational
          ? bColors.fill
          : `${bColors.fill}88`;
      ctx.fillRect(
        px + inset,
        py + inset,
        this.currentTileSize - inset * 2,
        this.currentTileSize - inset * 2,
      );

      // Building border
      ctx.strokeStyle = bColors.border;
      ctx.lineWidth = 1;
      ctx.strokeRect(
        px + inset,
        py + inset,
        this.currentTileSize - inset * 2,
        this.currentTileSize - inset * 2,
      );

      // Building label (only at higher zoom)
      if (this.camera.zoom > 0.8) {
        const label = BUILDING_LABELS[building.type] || "??";
        const fontSize = Math.max(6, Math.floor(this.currentTileSize * 0.25));
        ctx.font = `${fontSize}px "Press Start 2P", monospace`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          label,
          px + this.currentTileSize / 2,
          py + this.currentTileSize / 2,
        );
      }
    }

    // ─── Workers ───
    for (const worker of this.workers) {
      const px = totalX + worker.position.x * this.currentTileSize;
      const py = totalY + worker.position.y * this.currentTileSize;

      // Frustum culling
      if (
        px + this.currentTileSize < 0 ||
        px > canvas.width ||
        py + this.currentTileSize < 0 ||
        py > canvas.height
      ) {
        continue;
      }

      const workerSize = Math.max(2, this.currentTileSize * 0.35);
      const offset = (this.currentTileSize - workerSize) / 2;

      // Worker body — colour by state
      ctx.fillStyle = WORKER_STATE_COLORS[worker.state] || "#ffffff";
      ctx.fillRect(px + offset, py + offset, workerSize, workerSize);

      // Worker outline
      ctx.strokeStyle = "#000000";
      ctx.lineWidth = 1;
      ctx.strokeRect(px + offset, py + offset, workerSize, workerSize);

      // Carrying indicator (small dot above worker)
      if (worker.carrying && this.camera.zoom > 0.5) {
        const dotSize = Math.max(2, workerSize * 0.35);
        ctx.fillStyle = "#ffff00";
        ctx.fillRect(
          px + offset + workerSize / 2 - dotSize / 2,
          py + offset - dotSize - 1,
          dotSize,
          dotSize,
        );
      }
    }

    // ─── Selection highlight ───
    if (this.selectedBuilding && this.hoveredTileId !== null) {
      const tile = this.tiles[this.hoveredTileId];
      if (tile) {
        const coord = tileIdToCoord(this.hoveredTileId);
        const px = totalX + coord.x * this.currentTileSize;
        const py = totalY + coord.y * this.currentTileSize;

        const isValid = this.isPlacementValid(
          this.hoveredTileId,
          this.selectedBuilding,
        );

        ctx.strokeStyle = isValid
          ? "rgba(74, 175, 74, 0.8)"
          : "rgba(192, 64, 64, 0.8)";
        ctx.lineWidth = 2;
        ctx.strokeRect(px, py, this.currentTileSize, this.currentTileSize);

        // Semi-transparent fill
        ctx.fillStyle = isValid
          ? "rgba(74, 175, 74, 0.15)"
          : "rgba(192, 64, 64, 0.15)";
        ctx.fillRect(px, py, this.currentTileSize, this.currentTileSize);
      }
    }
  }
}
