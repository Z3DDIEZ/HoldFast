// NO Math.random() — simulation must be deterministic
import { makeNoise2D } from "open-simplex-noise";
import type { TileState, TileType } from "./tick-types";

const MAP_WIDTH = 80;
const MAP_HEIGHT = 80;

// djb2 hash implementation
function djb2(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return hash >>> 0;
}

export function generateMap(seed: string): TileState[] {
  const seedNum = djb2(seed);
  const noise2D = makeNoise2D(seedNum);
  const scale = 0.05;

  const tiles: TileState[] = [];

  for (let row = 0; row < MAP_HEIGHT; row++) {
    for (let col = 0; col < MAP_WIDTH; col++) {
      const noiseValue = noise2D(col * scale, row * scale);
      const id = row * MAP_WIDTH + col;

      let type: TileType = "GRASSLAND";
      let walkable = true;

      if (noiseValue < -0.3) {
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

      tiles.push({
        id,
        type,
        owned: false,
        walkable,
        buildingId: null,
      });
    }
  }

  return tiles;
}
