// NO Math.random() — simulation must be deterministic
import type { TileCoordinate, TileState } from "./tick-types";

/** Internal node used by A* pathfinding. */
interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to end
  f: number; // Total cost (g + h)
  id: number; // Tile ID for deterministic tie-breaking
  parent: PathNode | null;
}

/** Manhattan distance heuristic — admissible for 4-directional movement. */
function getManhattanDistance(a: TileCoordinate, b: TileCoordinate): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * Converts a tile coordinate to a flat tile ID.
 * @param coord — {x, y} tile position
 * @param mapWidth — grid width (default 80)
 * @returns tile ID = y * mapWidth + x
 */
export function tileCoordToId(
  coord: TileCoordinate,
  mapWidth: number = 80,
): number {
  return coord.y * mapWidth + coord.x;
}

/**
 * Converts a flat tile ID to a tile coordinate.
 * @param id — tile ID (row * mapWidth + col)
 * @param mapWidth — grid width (default 80)
 * @returns {x, y} tile position
 */
export function tileIdToCoord(
  id: number,
  mapWidth: number = 80,
): TileCoordinate {
  return {
    x: id % mapWidth,
    y: Math.floor(id / mapWidth),
  };
}

/**
 * Binary search for sorted insertion position.
 * Maintains sort by f-cost, with tile ID as deterministic tie-breaker.
 * Returns the index at which to insert the node.
 */
function binaryInsertIndex(list: PathNode[], node: PathNode): number {
  let lo = 0;
  let hi = list.length;

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const cmp = list[mid];
    if (cmp.f < node.f || (cmp.f === node.f && cmp.id < node.id)) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }
  return lo;
}

/** Insert a node into the sorted open list at the correct position. */
function sortedInsert(list: PathNode[], node: PathNode): void {
  const idx = binaryInsertIndex(list, node);
  list.splice(idx, 0, node);
}

/** 4-directional movement offsets (Up, Down, Left, Right). */
const DIRECTIONS: readonly TileCoordinate[] = [
  { x: 0, y: -1 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
  { x: 1, y: 0 },
];

/**
 * A* pathfinding over the walkable tile graph.
 *
 * Path is computed once per destination change, not per tick.
 * Results exclude the start tile and include the end tile.
 *
 * Tie-breaking: when two nodes have equal f-cost, the one with the
 * lower tile ID wins (row × MAP_WIDTH + col). This ensures identical
 * path selection across runs with the same map and inputs.
 *
 * @param start — starting tile coordinate
 * @param end — destination tile coordinate
 * @param tiles — flat tile state array (6400 entries for 80×80)
 * @returns ordered array of TileCoordinates from start (exclusive) to end (inclusive), or empty if no path
 */
export function findPath(
  start: TileCoordinate,
  end: TileCoordinate,
  tiles: TileState[],
): TileCoordinate[] {
  if (start.x === end.x && start.y === end.y) return [];

  const openList: PathNode[] = [];
  const closedSet = new Set<number>();
  // Map from tile ID to node for O(1) lookup in open list
  const openMap = new Map<number, PathNode>();

  const startNode: PathNode = {
    x: start.x,
    y: start.y,
    g: 0,
    h: getManhattanDistance(start, end),
    f: 0,
    id: tileCoordToId(start),
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  sortedInsert(openList, startNode);
  openMap.set(startNode.id, startNode);

  while (openList.length > 0) {
    // Pop the lowest f-cost node (already sorted — O(1) access)
    const current = openList.shift()!;
    openMap.delete(current.id);

    if (current.x === end.x && current.y === end.y) {
      // Reconstruct path: start (exclusive) to end (inclusive)
      const path: TileCoordinate[] = [];
      let temp: PathNode | null = current;
      while (temp && (temp.x !== start.x || temp.y !== start.y)) {
        path.push({ x: temp.x, y: temp.y });
        temp = temp.parent;
      }
      return path.reverse();
    }

    closedSet.add(current.id);

    for (const dir of DIRECTIONS) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;

      if (nx < 0 || nx >= 80 || ny < 0 || ny >= 80) continue;

      const nId = ny * 80 + nx;
      if (closedSet.has(nId)) continue;

      const tile = tiles[nId];

      // Walkability rules:
      // - tile.walkable refers to terrain (not water)
      // - Exception: destination tile is always reachable
      const isEnd = nx === end.x && ny === end.y;
      const isWalkable = tile.walkable || isEnd;

      if (!isWalkable) continue;

      const gScore = current.g + 1;
      const existing = openMap.get(nId);

      if (!existing) {
        const neighborNode: PathNode = {
          x: nx,
          y: ny,
          g: gScore,
          h: getManhattanDistance({ x: nx, y: ny }, end),
          f: 0,
          id: nId,
          parent: current,
        };
        neighborNode.f = neighborNode.g + neighborNode.h;
        sortedInsert(openList, neighborNode);
        openMap.set(nId, neighborNode);
      } else if (gScore < existing.g) {
        // Remove from current position, update, re-insert sorted
        const oldIdx = openList.indexOf(existing);
        if (oldIdx !== -1) openList.splice(oldIdx, 1);

        existing.g = gScore;
        existing.f = existing.g + existing.h;
        existing.parent = current;

        sortedInsert(openList, existing);
      }
    }
  }

  return []; // No path exists
}
