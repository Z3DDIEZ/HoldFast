// NO Math.random() — simulation must be deterministic
import { makeNoise2D } from "open-simplex-noise";
import type { TileState, TileType } from "./tick-types";

/** Map dimensions in tiles. */
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 80;

/** Center tile coordinates — guaranteed habitable. */
export const CENTER_X = 40;
export const CENTER_Y = 40;

/**
 * Radius around the center guaranteed to be non-water, walkable terrain.
 * Ensures workers always have space to operate at game start.
 */
const HABITABLE_RADIUS = 4;

/**
 * Initial vision radius around the center tile.
 * Tiles within this Manhattan distance start visible.
 */
const INITIAL_VISION_RADIUS = 6;

/**
 * djb2 hash — converts a string seed into a numeric seed for noise generation.
 * Deterministic: same string always produces the same number.
 */
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

/**
 * Generates the 80×80 tile grid from a deterministic seed.
 * Uses 2D Simplex noise for terrain assignment with biome-based thresholds.
 *
 * @param seed — string seed for deterministic map generation
 * @returns Array of 6400 TileState objects (row-major order)
 */
export function generateMap(seed: string): TileState[] {
  const seedNum = djb2(seed);
  const noise2D = makeNoise2D(seedNum);
  const scale = 0.05;

  const tiles: TileState[] = [];

  for (let row = 0; row < MAP_HEIGHT; row++) {
    for (let col = 0; col < MAP_WIDTH; col++) {
      const noiseValue = noise2D(col * scale, row * scale);
      const id = row * MAP_WIDTH + col;

      // Manhattan distance from center
      const distFromCenter =
        Math.abs(col - CENTER_X) + Math.abs(row - CENTER_Y);

      // Determine if this tile is in the guaranteed habitable zone
      const isHabitableZone = distFromCenter <= HABITABLE_RADIUS;

      let type: TileType;
      let walkable: boolean;

      if (isHabitableZone) {
        // Force habitable terrain — never water in the starting zone
        if (noiseValue < -0.05) {
          type = "GRASSLAND"; // Override would-be water/barren
        } else if (noiseValue < 0.1) {
          type = "GRASSLAND";
        } else if (noiseValue < 0.3) {
          type = "FOREST";
        } else {
          type = "STONE_DEPOSIT";
        }
        walkable = true;
      } else if (noiseValue < -0.3) {
        type = "WATER";
        walkable = false;
      } else if (noiseValue < -0.05) {
        type = "BARREN";
        walkable = true;
      } else if (noiseValue < 0.1) {
        type = "GRASSLAND";
        walkable = true;
      } else if (noiseValue < 0.3) {
        type = "FOREST";
        walkable = true;
      } else {
        type = "STONE_DEPOSIT";
        walkable = true;
      }

      // Center tile is always grassland and owned
      const isCenter = row === CENTER_Y && col === CENTER_X;

      tiles.push({
        id,
        type: isCenter ? "GRASSLAND" : type,
        owned: isCenter,
        walkable,
        visible: false,
        buildingId: null,
      });
    }
  }

  // Starting visibility with forest line-of-sight blocking
  for (const tile of tiles) {
    const coord = { x: tile.id % MAP_WIDTH, y: Math.floor(tile.id / MAP_WIDTH) };
    const dist =
      Math.abs(coord.x - CENTER_X) + Math.abs(coord.y - CENTER_Y);
    if (dist <= INITIAL_VISION_RADIUS) {
      tile.visible = hasLineOfSight(
        tiles,
        CENTER_X,
        CENTER_Y,
        coord.x,
        coord.y,
      );
    }
  }

  return tiles;
}

function hasLineOfSight(
  tiles: TileState[],
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  let x0 = fromX;
  let y0 = fromY;
  const x1 = toX;
  const y1 = toY;

  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (!(x0 === x1 && y0 === y1)) {
    const e2 = err * 2;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }

    if (x0 === x1 && y0 === y1) {
      break;
    }

    const idx = y0 * MAP_WIDTH + x0;
    if (tiles[idx]?.type === "FOREST") {
      return false;
    }
  }

  return true;
}

/**
 * Expands ownership and visibility around a tile (e.g. when a building is placed).
 * Marks tiles within `radius` Manhattan distance as owned and visible.
 *
 * @param tiles — the full tile array (mutated in place)
 * @param centerTileId — the tile ID to expand from
 * @param ownershipRadius — Manhattan distance for ownership expansion
 * @param visionRadius — Manhattan distance for visibility expansion
 */
export function expandTerritory(
  tiles: TileState[],
  centerTileId: number,
  ownershipRadius: number = 3,
  visionRadius: number = 5,
): void {
  const cx = centerTileId % MAP_WIDTH;
  const cy = Math.floor(centerTileId / MAP_WIDTH);

  const maxRadius = Math.max(ownershipRadius, visionRadius);

  for (let dy = -maxRadius; dy <= maxRadius; dy++) {
    for (let dx = -maxRadius; dx <= maxRadius; dx++) {
      const nx = cx + dx;
      const ny = cy + dy;

      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;

      const dist = Math.abs(dx) + Math.abs(dy);
      const tileId = ny * MAP_WIDTH + nx;
      const tile = tiles[tileId];

      if (dist <= ownershipRadius && tile.type !== "WATER") {
        tile.owned = true;
      }
      if (dist <= visionRadius) {
        if (hasLineOfSight(tiles, cx, cy, nx, ny)) {
          tile.visible = true;
        }
      }
    }
  }
}
