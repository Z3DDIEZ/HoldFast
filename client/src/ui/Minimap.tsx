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
  }, [tiles, buildings]);

  return (
    <div className="fixed bottom-[96px] right-0 w-[160px] h-[160px] border border-[#2a2a2a] bg-[#0f0f0f] z-40 flex items-center justify-center p-0 overflow-hidden select-none pointer-events-none">
      <canvas
        ref={canvasRef}
        width={MAP_DIM * TILE_SIZE}
        height={MAP_DIM * TILE_SIZE}
        className="rendering-pixelated"
        style={{ imageRendering: "pixelated" }}
      />
      <div className="absolute top-1 left-1 px-1 bg-[#0f0f0f88]">
        <span style={{ color: "#888870", fontSize: "6px" }}>CAM: 0,0</span>
      </div>
    </div>
  );
}
