import { useEffect, useRef } from "react";
import { useGameStore } from "../state/game-store";
import type { TileType } from "../state/types";
import { tileIdToCoord } from "../engine/pathfinder";

const TILE_SIZE = 2; // 2x2 pixels per tile on minimap
const MAP_DIM = 80;

const COLORS: Record<TileType, string> = {
  GRASSLAND: "#4a7c3f",
  FOREST: "#2d5a1b",
  STONE_DEPOSIT: "#7a7a6e",
  WATER: "#2a5f8f",
  BARREN: "#8f7a5a",
};

const FOG_COLOR = "#000000";

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiles = useGameStore((s) => s.tiles);
  const buildings = useGameStore((s) => s.buildings);
  const camera = useGameStore((s) => s.camera);
  const updateCamera = useGameStore((s) => s.updateCamera);

  const handleMinimapClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Map coordinate (0-160) to global map units
    const tx = (x / (MAP_DIM * TILE_SIZE)) * 80;
    const ty = (y / (MAP_DIM * TILE_SIZE)) * 80;

    // Center camera on this tile
    // 1 tile = 32px standard (16*2).
    // center of screen = window.innerWidth/2
    const tileSizePx = 16 * 2 * camera.zoom;
    const targetOffsetNX = window.innerWidth / 2 - tx * tileSizePx;
    const targetOffsetNY = window.innerHeight / 2 - ty * tileSizePx;

    updateCamera({ offsetX: targetOffsetNX, offsetY: targetOffsetNY });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear and draw background
    ctx.fillStyle = FOG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (tiles && tiles.length > 0) {
      for (const tile of tiles) {
        const coord = tileIdToCoord(tile.id);
        ctx.fillStyle = COLORS[tile.type] || COLORS.BARREN;
        ctx.fillRect(
          coord.x * TILE_SIZE,
          coord.y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
    }

    // Draw buildings as small white dots
    if (buildings) {
      ctx.fillStyle = "#ffffff";
      for (const building of buildings) {
        const coord = tileIdToCoord(building.tileId);
        ctx.fillRect(
          coord.x * TILE_SIZE,
          coord.y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
    }

    // Draw viewport rectangle
    const tileSizePx = 16 * 2 * camera.zoom;
    const viewW = (window.innerWidth / tileSizePx) * TILE_SIZE;
    const viewH = (window.innerHeight / tileSizePx) * TILE_SIZE;

    // Reverse calculation: where is (window.innerWidth/2 - camera.offsetX) / tileSizePx ?
    // Actually totalX = cameraX (centered map) + offsetX.
    // So 0,0 on screen = - (cameraX + offsetX) / tileSizePx
    // Let's simplify:
    // center of view in map tiles:
    const mapWidthPx = 80 * tileSizePx;
    const cameraX = (window.innerWidth - mapWidthPx) / 2;
    // Wait, cameraY calculation depends on mapHeightPx which is same as mapWidthPx here (80*80).
    const cameraY = (window.innerHeight - mapWidthPx) / 2;
    const viewTileX = (0 - cameraX - camera.offsetX) / tileSizePx;
    const viewTileY = (0 - cameraY - camera.offsetY) / tileSizePx;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1;
    ctx.strokeRect(viewTileX * TILE_SIZE, viewTileY * TILE_SIZE, viewW, viewH);
  }, [tiles, buildings, camera]);

  return (
    <div className="fixed bottom-[96px] right-0 w-[160px] h-[160px] border border-[#2a2a2a] bg-[#0f0f0f] z-40 flex items-center justify-center p-0 overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        width={MAP_DIM * TILE_SIZE}
        height={MAP_DIM * TILE_SIZE}
        className="rendering-pixelated cursor-pointer pointer-events-auto"
        style={{ imageRendering: "pixelated" }}
        onClick={handleMinimapClick}
      />
      <div className="absolute top-1 left-1 px-1 bg-[#0f0f0f88] pointer-events-none">
        <span style={{ color: "#888870", fontSize: "6px" }}>
          ZOOM: {camera.zoom.toFixed(1)}x
        </span>
      </div>
    </div>
  );
}
