// NO Math.random() — simulation must be deterministic
import { makeNoise2D } from "open-simplex-noise";
import type { TileState, TileType, TileCoordinate, CivilizationId } from "./tick-types";

/** Map dimensions in tiles. */
export const MAP_WIDTH = 80;
export const MAP_HEIGHT = 80;

/** Center tile coordinates — used as default fallback. */
export const CENTER_X = 40;
export const CENTER_Y = 40;

/**
 * Radius around a spawn point guaranteed to be non-water, walkable terrain.
 * Ensures workers always have space to operate at game start.
 */
const HABITABLE_RADIUS = 4;

/**
 * Initial vision radius around a spawn point.
 * Tiles within this Manhattan distance start visible.
 */
const INITIAL_VISION_RADIUS = 6;

/** Margin from map edges for corner spawn positions. */
const CORNER_MARGIN = 8;

/**
 * Returns the 4 corner spawn positions on the map.
 * Each position is guaranteed to be `CORNER_MARGIN` tiles from the edges.
 *
 * @returns Array of 4 TileCoordinate positions (top-left, top-right, bottom-left, bottom-right)
 */
export function getCornerSpawns(): TileCoordinate[] {
  return [
    { x: CORNER_MARGIN, y: CORNER_MARGIN },                           // Top-left
    { x: MAP_WIDTH - 1 - CORNER_MARGIN, y: CORNER_MARGIN },           // Top-right
    { x: CORNER_MARGIN, y: MAP_HEIGHT - 1 - CORNER_MARGIN },          // Bottom-left
    { x: MAP_WIDTH - 1 - CORNER_MARGIN, y: MAP_HEIGHT - 1 - CORNER_MARGIN }, // Bottom-right
  ];
}

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
 * Ensures a habitable zone around a given anchor point.
 * Forces non-water walkable terrain within HABITABLE_RADIUS.
 *
 * @param tiles — the full tile array (mutated in place)
 * @param anchorX — center X of the habitable zone
 * @param anchorY — center Y of the habitable zone
 * @param noise2D — noise function for determining terrain type
 */
function ensureHabitableZone(
  tiles: TileState[],
  anchorX: number,
  anchorY: number,
  noise2D: (x: number, y: number) => number,
): void {
  for (let dy = -HABITABLE_RADIUS; dy <= HABITABLE_RADIUS; dy++) {
    for (let dx = -HABITABLE_RADIUS; dx <= HABITABLE_RADIUS; dx++) {
      const nx = anchorX + dx;
      const ny = anchorY + dy;

      if (nx < 0 || nx >= MAP_WIDTH || ny < 0 || ny >= MAP_HEIGHT) continue;

      const dist = Math.abs(dx) + Math.abs(dy);
      if (dist > HABITABLE_RADIUS) continue;

      const tileId = ny * MAP_WIDTH + nx;
      const tile = tiles[tileId];
      if (!tile) continue;

      // Centre tile is always Grassland (for Town Hall)
      if (dx === 0 && dy === 0) {
        tile.type = "GRASSLAND";
        tile.walkable = true;
        continue;
      }

      // Immediate clearance
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
        tile.type = "GRASSLAND";
        tile.walkable = true;
        continue;
      }

      // Guaranteed resource patches relative to anchor
      if (dx === 2 && dy === 0) {
        tile.type = "FOREST";
        tile.walkable = true;
        continue;
      }
      if (dx === -2 && dy === 0) {
        tile.type = "STONE_DEPOSIT";
        tile.walkable = true;
        continue;
      }
      if (dx === 0 && dy === 2) {
        tile.type = "GRASSLAND";
        tile.walkable = true;
        continue;
      }

      // Fill rest of zone with noise-based selection, but no water
      const noiseVal = noise2D(nx * 0.035, ny * 0.035);
      if (noiseVal < 0.1) {
        tile.type = "GRASSLAND";
      } else if (noiseVal < 0.45) {
        tile.type = "FOREST";
      } else {
        tile.type = "STONE_DEPOSIT";
      }
      tile.walkable = true;
    }
  }
}

/**
 * Generates the 80×80 tile grid from a deterministic seed.
 * Uses fractal noise for terrain assignment with biome-based thresholds.
 *
 * @param seed — string seed for deterministic map generation
 * @returns Array of 6400 TileState objects (row-major order)
 */
export function generateMap(seed: string): TileState[] {
  const seedNum = djb2(seed);
  const noise2D = makeNoise2D(seedNum);
  
  const tiles: TileState[] = [];

  for (let row = 0; row < MAP_HEIGHT; row++) {
    for (let col = 0; col < MAP_WIDTH; col++) {
      // Multi-octave (Fractal) Noise
      let noiseValue = 0;
      let amplitude = 1;
      let frequency = 0.035;
      let maxAmplitude = 0;

      for (let i = 0; i < 4; i++) {
        noiseValue += noise2D(col * frequency, row * frequency) * amplitude;
        maxAmplitude += amplitude;
        amplitude *= 0.5;
        frequency *= 2;
      }
      noiseValue /= maxAmplitude;

      const id = row * MAP_WIDTH + col;

      let type: TileType;
      let walkable: boolean;

      if (noiseValue < -0.35) {
        type = "WATER";
        walkable = false;
      } else if (noiseValue < -0.1) {
        type = "BARREN";
        walkable = true;
      } else if (noiseValue < 0.15) {
        type = "GRASSLAND";
        walkable = true;
      } else if (noiseValue < 0.38) {
        type = "FOREST";
        walkable = true;
      } else {
        type = "STONE_DEPOSIT";
        walkable = true;
      }

      tiles.push({
        id,
        type,
        owned: false,
        ownerId: null,
        walkable,
        visible: false,
        buildingId: null,
      });
    }
  }

  return tiles;
}

/**
 * Generates a multi-start map with habitable zones at specified spawn positions.
 * Applies vision around each spawn point.
 *
 * @param seed — string seed for deterministic map generation
 * @param spawnPositions — array of anchor points for each civilization
 * @returns Array of 6400 TileState objects with habitable zones carved out
 */
export function generateMultiStartMap(
  seed: string,
  spawnPositions: TileCoordinate[],
): TileState[] {
  const seedNum = djb2(seed);
  const noise2D = makeNoise2D(seedNum);
  const tiles = generateMap(seed);

  // Carve habitable zones at each spawn position
  for (const spawn of spawnPositions) {
    ensureHabitableZone(tiles, spawn.x, spawn.y, noise2D);
  }

  // Apply initial vision around each spawn
  for (const spawn of spawnPositions) {
    applyInitialVision(tiles, spawn.x, spawn.y);
  }

  return tiles;
}

/**
 * Applies initial vision around a spawn point using line-of-sight.
 */
function applyInitialVision(
  tiles: TileState[],
  cx: number,
  cy: number,
): void {
  for (const tile of tiles) {
    const coord = { x: tile.id % MAP_WIDTH, y: Math.floor(tile.id / MAP_WIDTH) };
    const dist = Math.abs(coord.x - cx) + Math.abs(coord.y - cy);
    if (dist <= INITIAL_VISION_RADIUS) {
      if (hasLineOfSight(tiles, cx, cy, coord.x, coord.y)) {
        tile.visible = true;
      }
    }
  }
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
 * Only claims tiles that are not already owned by another civ (first-owner-wins).
 *
 * @param tiles — the full tile array (mutated in place)
 * @param centerTileId — the tile ID to expand from
 * @param ownerId — the civilization claiming ownership
 * @param ownershipRadius — Manhattan distance for ownership expansion
 * @param visionRadius — Manhattan distance for visibility expansion
 */
export function expandTerritory(
  tiles: TileState[],
  centerTileId: number,
  ownerId: CivilizationId,
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
        // First-owner-wins: only claim unowned tiles or tiles we already own
        if (!tile.owned || tile.ownerId === ownerId) {
          tile.owned = true;
          tile.ownerId = ownerId;
        }
      }
      if (dist <= visionRadius) {
        if (hasLineOfSight(tiles, cx, cy, nx, ny)) {
          tile.visible = true;
        }
      }
    }
  }
}
