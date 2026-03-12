import { useEffect, useRef } from "react";
import { useGameStore } from "../state/game-store";
import type { TileType } from "../state/types";
import { tileIdToCoord } from "../engine/pathfinder";

/** Minimap pixels per tile. */
const TILE_SIZE = 2;
/** Map dimension in tiles. */
const MAP_DIM = 80;

/** Tile base colours for minimap rendering. */
const TILE_COLORS: Record<TileType, string> = {
  GRASSLAND: "#4a7c3f",
  FOREST: "#2d5a1b",
  STONE_DEPOSIT: "#7a7a6e",
  WATER: "#2a5f8f",
  BARREN: "#8f7a5a",
};

/** Brighter owned-territory tint colours. */
const OWNED_COLORS: Record<TileType, string> = {
  GRASSLAND: "#6aaf55",
  FOREST: "#3d7a25",
  STONE_DEPOSIT: "#9a9a8e",
  WATER: "#3a7fbf",
  BARREN: "#a89060",
};

const FOG_COLOR = "#0a0a0a";

/** Building colours for minimap dots. */
const BUILDING_COLORS: Record<string, string> = {
  TOWN_HALL: "#c8a020",
  FORAGER_HUT: "#6aaf55",
  LUMBER_MILL: "#8b6914",
  QUARRY: "#909090",
  STOREHOUSE: "#c8b888",
  FARM: "#4a8f3f",
  LIBRARY: "#6a60c0",
  BARRACKS: "#c04040",
};

/**
 * Minimap component: 160×160px scaled-down view of the full map.
 * Click-to-navigate, shows owned territory, buildings, and viewport rectangle.
 */
export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tiles = useGameStore((s) => s.tiles);
  const buildings = useGameStore((s) => s.buildings);
  const camera = useGameStore((s) => s.camera);
  const updateCamera = useGameStore((s) => s.updateCamera);

  /** Handle minimap click — center the main viewport on the clicked tile. */
  const handleMinimapClick = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert minimap pixel to tile coordinate
    const tileX = (x / (MAP_DIM * TILE_SIZE)) * MAP_DIM;
    const tileY = (y / (MAP_DIM * TILE_SIZE)) * MAP_DIM;

    // Calculate offset to center this tile in the viewport
    const tileSizePx = 16 * 2 * camera.zoom;
    const mapWidthPx = MAP_DIM * tileSizePx;

    // cameraX is the base centering offset: (viewportWidth - mapWidth) / 2
    // So total tile position in screen space = cameraX + offsetX + tileX * tileSizePx
    // We want tileX * tileSizePx + cameraX + newOffsetX = viewportWidth / 2
    // => newOffsetX = viewportWidth/2 - cameraX - tileX * tileSizePx
    const cameraBaseX = (window.innerWidth - mapWidthPx) / 2;
    const cameraBaseY = (window.innerHeight - mapWidthPx) / 2;

    const newOffsetX = window.innerWidth / 2 - cameraBaseX - tileX * tileSizePx;
    const newOffsetY =
      window.innerHeight / 2 - cameraBaseY - tileY * tileSizePx;

    updateCamera({ offsetX: newOffsetX, offsetY: newOffsetY });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear
    ctx.fillStyle = FOG_COLOR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (tiles && tiles.length > 0) {
      // Render tiles
      for (const tile of tiles) {
        const coord = tileIdToCoord(tile.id);

        if (!tile.visible) {
          ctx.fillStyle = FOG_COLOR;
        } else if (tile.owned) {
          ctx.fillStyle = OWNED_COLORS[tile.type] || TILE_COLORS.BARREN;
        } else {
          ctx.fillStyle = TILE_COLORS[tile.type] || TILE_COLORS.BARREN;
        }

        ctx.fillRect(
          coord.x * TILE_SIZE,
          coord.y * TILE_SIZE,
          TILE_SIZE,
          TILE_SIZE,
        );
      }
    }

    // Draw buildings as coloured dots
    if (buildings) {
      for (const building of buildings) {
        const coord = tileIdToCoord(building.tileId);
        ctx.fillStyle = BUILDING_COLORS[building.type] || "#ffffff";
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
    const mapWidthPx = MAP_DIM * tileSizePx;

    const cameraBaseX = (window.innerWidth - mapWidthPx) / 2;
    const cameraBaseY = (window.innerHeight - mapWidthPx) / 2;

    // Top-left of viewport in tile coordinates
    const viewTileX = (0 - cameraBaseX - camera.offsetX) / tileSizePx;
    const viewTileY = (0 - cameraBaseY - camera.offsetY) / tileSizePx;

    // Viewport size in tile coordinates
    const viewTilesW = window.innerWidth / tileSizePx;
    const viewTilesH = window.innerHeight / tileSizePx;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(
      viewTileX * TILE_SIZE,
      viewTileY * TILE_SIZE,
      viewTilesW * TILE_SIZE,
      viewTilesH * TILE_SIZE,
    );
  }, [tiles, buildings, camera]);

  return (
    <div className="fixed bottom-[96px] right-0 w-[160px] h-[160px] border border-[#2a2a2a] bg-[#0f0f0f] z-40 flex items-center justify-center p-0 overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        width={MAP_DIM * TILE_SIZE}
        height={MAP_DIM * TILE_SIZE}
        className="cursor-pointer pointer-events-auto"
        style={{ imageRendering: "pixelated" }}
        onClick={handleMinimapClick}
      />
      <div className="absolute top-1 left-1 px-1 bg-[#0f0f0f]/70 pointer-events-none">
        <span style={{ color: "#888870", fontSize: "6px" }}>
          {camera.zoom.toFixed(1)}×
        </span>
      </div>
    </div>
  );
}
