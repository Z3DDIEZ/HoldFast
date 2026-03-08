import type { GameState } from "../state/types";

const TILE_SIZE = 16;
const SCALE = 2; // Renders 16x16 as 32x32
const SCALED_TILE = TILE_SIZE * SCALE;

const COLORS = {
  grassland: { base: "#4a7c3f", border: "#3a5e30" },
  forest: { base: "#2d5a1b", border: "#1e3d12" },
  stone_deposit: { base: "#7a7a6e", border: "#5a5a50" },
  water: { base: "#2a5f8f", border: "#1a3f6f" },
  barren: { base: "#8f7a5a", border: "#6f5a3a" },
  fog: "#0a0a0a",
};

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private state: GameState | null = null;
  private cameraX = 0;
  private cameraY = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not initialize 2D context");
    this.ctx = ctx;

    // Fix scaling to prevent blurriness
    this.ctx.imageSmoothingEnabled = false;

    window.addEventListener("resize", this.handleResize);
    this.handleResize();

    // Start render loop
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

  public screenToTile(
    screenX: number,
    screenY: number,
  ): { x: number; y: number } | null {
    if (!this.state) return null;

    const tx = Math.floor((screenX - this.cameraX) / SCALED_TILE);
    const ty = Math.floor((screenY - this.cameraY) / SCALED_TILE);

    if (tx >= 0 && tx < 80 && ty >= 0 && ty < 80) {
      return { x: tx, y: ty };
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
    // Clear canvas
    this.ctx.fillStyle = COLORS.fog;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    if (!this.state || !this.state.tiles) return;

    // Basic centering logic used for coordinate mapping too
    const mapWidthPx = 80 * SCALED_TILE;
    const mapHeightPx = 80 * SCALED_TILE;
    this.cameraX = (this.canvas.width - mapWidthPx) / 2;
    this.cameraY = (this.canvas.height - mapHeightPx) / 2;

    for (const tile of this.state.tiles) {
      if (!tile.visible) continue;

      const px = this.cameraX + tile.x * SCALED_TILE;
      const py = this.cameraY + tile.y * SCALED_TILE;

      // Only draw if within viewport roughly
      if (
        px + SCALED_TILE < 0 ||
        px > this.canvas.width ||
        py + SCALED_TILE < 0 ||
        py > this.canvas.height
      ) {
        continue;
      }

      const colors = COLORS[tile.type] || COLORS.barren;

      // Fill
      this.ctx.fillStyle = colors.base;
      this.ctx.fillRect(px, py, SCALED_TILE, SCALED_TILE);
      this.ctx.strokeStyle = colors.border;
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(px, py, SCALED_TILE, SCALED_TILE);
    }

    // Workers
    if (this.state.workers) {
      for (const worker of this.state.workers) {
        const px = this.cameraX + worker.x * SCALED_TILE;
        const py = this.cameraY + worker.y * SCALED_TILE;
        this.ctx.fillStyle = "#ffffff";
        this.ctx.fillRect(px + 6, py + 6, SCALED_TILE - 12, SCALED_TILE - 12);
      }
    }

    // Buildings
    if (this.state.buildings) {
      for (const building of this.state.buildings) {
        const px = this.cameraX + building.x * SCALED_TILE;
        const py = this.cameraY + building.y * SCALED_TILE;
        this.ctx.fillStyle = "#c04040";
        this.ctx.fillRect(px + 2, py + 2, SCALED_TILE - 4, SCALED_TILE - 4);
      }
    }
  }
}
