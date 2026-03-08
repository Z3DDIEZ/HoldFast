import type { GameState } from "../state/types";
import { tileIdToCoord } from "../engine/pathfinder";

const TILE_SIZE = 16;
const BASE_SCALE = 2; // Default scale

const COLORS = {
  GRASSLAND: { base: "#4a7c3f", border: "#3a5e30" },
  FOREST: { base: "#2d5a1b", border: "#1e3d12" },
  STONE_DEPOSIT: { base: "#7a7a6e", border: "#5a5a50" },
  WATER: { base: "#2a5f8f", border: "#1a3f6f" },
  BARREN: { base: "#8f7a5a", border: "#6f5a3a" },
  FOG: "#0a0a0a",
};

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private state: GameState | null = null;

  // Camera state
  private zoom = 1.0;
  private offsetX = 0;
  private offsetY = 0;

  // Internal calculated values
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

  public updateState(newState: GameState) {
    this.state = newState;
  }

  public setZoom(delta: number) {
    this.zoom = Math.min(Math.max(0.2, this.zoom + delta), 4.0);
    this.currentTileSize = TILE_SIZE * BASE_SCALE * this.zoom;
  }

  public pan(dx: number, dy: number) {
    this.offsetX += dx;
    this.offsetY += dy;
  }

  public screenToTileId(screenX: number, screenY: number): number | null {
    if (!this.state) return null;

    const tx = Math.floor(
      (screenX - this.cameraX - this.offsetX) / this.currentTileSize,
    );
    const ty = Math.floor(
      (screenY - this.cameraY - this.offsetY) / this.currentTileSize,
    );

    if (tx >= 0 && tx < 80 && ty >= 0 && ty < 80) {
      return ty * 80 + tx;
    }
    return null;
  }

  public cleanup() {
    window.removeEventListener("resize", this.handleResize);
  }

  private renderLoop = () => {
    this.render();
    requestAnimationFrame(this.renderLoop);
  };

  private render() {
    this.ctx.fillStyle = COLORS.FOG;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.state || !this.state.tiles) return;

    const mapWidthPx = 80 * this.currentTileSize;
    const mapHeightPx = 80 * this.currentTileSize;

    // Centralized camera base
    this.cameraX = (this.canvas.width - mapWidthPx) / 2;
    this.cameraY = (this.canvas.height - mapHeightPx) / 2;

    const totalX = this.cameraX + this.offsetX;
    const totalY = this.cameraY + this.offsetY;

    for (const tile of this.state.tiles) {
      // PRD: TileState doesn't have visibility for now, but keeping the concept if needed
      // Actually PRD has 'owned'. Tile visibility isn't in tick-types but we can assume visible for now.

      const coord = tileIdToCoord(tile.id);
      const px = totalX + coord.x * this.currentTileSize;
      const py = totalY + coord.y * this.currentTileSize;

      if (
        px + this.currentTileSize < 0 ||
        px > this.canvas.width ||
        py + this.currentTileSize < 0 ||
        py > this.canvas.height
      ) {
        continue;
      }

      const colors = (COLORS as any)[tile.type] || COLORS.BARREN;
      this.ctx.fillStyle = colors.base;
      this.ctx.fillRect(px, py, this.currentTileSize, this.currentTileSize);

      // Only draw borders if zoomed in enough
      if (this.zoom > 0.5) {
        this.ctx.strokeStyle = colors.border;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(px, py, this.currentTileSize, this.currentTileSize);
      }

      if (tile.owned) {
        this.ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
        this.ctx.strokeRect(
          px + 1,
          py + 1,
          this.currentTileSize - 2,
          this.currentTileSize - 2,
        );
      }
    }

    // Workers
    if (this.state.workers) {
      for (const worker of this.state.workers) {
        const px = totalX + worker.position.x * this.currentTileSize;
        const py = totalY + worker.position.y * this.currentTileSize;

        const workerSize = this.currentTileSize * 0.4;
        const offset = (this.currentTileSize - workerSize) / 2;

        this.ctx.fillStyle =
          worker.state === "STARVING" ? "#ff5555" : "#ffffff";
        this.ctx.fillRect(px + offset, py + offset, workerSize, workerSize);

        if (worker.carrying && this.zoom > 0.6) {
          this.ctx.fillStyle = "#ffff00";
          this.ctx.fillRect(
            px + offset + workerSize * 0.4,
            py + offset - 4,
            4,
            4,
          );
        }
      }
    }

    // Buildings
    if (this.state.buildings) {
      for (const building of this.state.buildings) {
        const coord = tileIdToCoord(building.tileId);
        const px = totalX + coord.x * this.currentTileSize;
        const py = totalY + coord.y * this.currentTileSize;

        this.ctx.fillStyle = building.operational ? "#c04040" : "#444444";
        this.ctx.fillRect(
          px + 2,
          py + 2,
          this.currentTileSize - 4,
          this.currentTileSize - 4,
        );
      }
    }
  }
}
