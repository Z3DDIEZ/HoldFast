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
        } else if (noiseValue < 0.2) {
          type = "GRASSLAND";
        } else if (noiseValue < 0.5) {
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
      } else if (noiseValue < 0.2) {
        type = "GRASSLAND";
        walkable = true;
      } else if (noiseValue < 0.5) {
        type = "FOREST";
        walkable = true;
      } else {
        type = "STONE_DEPOSIT";
        walkable = true;
      }

      // Center tile is always grassland and owned
      const isCenter = row === CENTER_Y && col === CENTER_X;

      // Starting visibility — tiles near center are visible
      const visible = distFromCenter <= INITIAL_VISION_RADIUS;

      tiles.push({
        id,
        type: isCenter ? "GRASSLAND" : type,
        owned: isCenter,
        walkable,
        visible,
        buildingId: null,
      });
    }
  }

  return tiles;
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
        tile.visible = true;
      }
    }
  }
}
