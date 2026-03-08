import { makeNoise2D } from "open-simplex-noise";
import type { TileState, TileType } from "../state/types";

const MAP_SIZE = 80;

// Deterministic random pseudo-generator (Mulberry32)
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Convert string seed to number
function seedFromString(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++)
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return h;
}

export function generateMap(seedString: string): TileState[] {
  const seedNum = seedFromString(seedString);
  const prng = mulberry32(seedNum);
  const noise2D = makeNoise2D(seedNum);

  const tiles: TileState[] = [];
  const scale = 0.08;

  for (let y = 0; y < MAP_SIZE; y++) {
    for (let x = 0; x < MAP_SIZE; x++) {
      // Base elevation via Simplex noise
      const elevation = noise2D(x * scale, y * scale);

      let type: TileType = "grassland";

      if (elevation < -0.4) {
        type = "water";
      } else if (elevation > 0.6) {
        type = "barren";
      } else if (elevation > 0.3) {
        // Higher altitudes might have forests or stone
        const roll = prng();
        if (roll > 0.8) {
          type = "stone_deposit";
        } else if (roll > 0.4) {
          type = "forest";
        }
      } else {
        // Medium/Low altitudes
        if (prng() > 0.85) {
          type = "forest";
        }
      }

      // Initial fog of war - only center is visible initially
      const cx = MAP_SIZE / 2;
      const cy = MAP_SIZE / 2;
      const distToCenter = Math.sqrt(Math.pow(x - cx, 2) + Math.pow(y - cy, 2));
      const visible = distToCenter <= 5; // Reveal radius of 5 from the start

      tiles.push({
        x,
        y,
        type,
        visible,
      });
    }
  }

  return tiles;
}
