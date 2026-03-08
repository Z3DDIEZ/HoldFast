// NO Math.random() — simulation must be deterministic
import type { TileCoordinate, TileState } from "./tick-types";

interface PathNode {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to end
  f: number; // Total cost
  id: number; // For tie-breaking
  parent: PathNode | null;
}

function getManhattanDistance(a: TileCoordinate, b: TileCoordinate): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function tileCoordToId(
  coord: TileCoordinate,
  mapWidth: number = 80,
): number {
  return coord.y * mapWidth + coord.x;
}

export function tileIdToCoord(
  id: number,
  mapWidth: number = 80,
): TileCoordinate {
  return {
    x: id % mapWidth,
    y: Math.floor(id / mapWidth),
  };
}

export function findPath(
  start: TileCoordinate,
  end: TileCoordinate,
  tiles: TileState[],
): TileCoordinate[] {
  if (start.x === end.x && start.y === end.y) return [];

  const openList: PathNode[] = [];
  const closedSet = new Set<number>();

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

  openList.push(startNode);

  while (openList.length > 0) {
    // Sort open list by f-cost, then by id for deterministic tie-breaking
    openList.sort((a, b) => {
      if (a.f !== b.f) return a.f - b.f;
      return a.id - b.id;
    });

    const current = openList.shift()!;

    if (current.x === end.x && current.y === end.y) {
      // Reconstruct path
      const path: TileCoordinate[] = [];
      let temp: PathNode | null = current;
      // PRD: Returns path from start to end, excluding start, including end.
      while (temp && (temp.x !== start.x || temp.y !== start.y)) {
        path.push({ x: temp.x, y: temp.y });
        temp = temp.parent;
      }
      return path.reverse();
    }

    closedSet.add(current.id);

    // 4-directional neighbours only
    const directions = [
      { x: 0, y: -1 }, // Up
      { x: 0, y: 1 }, // Down
      { x: -1, y: 0 }, // Left
      { x: 1, y: 0 }, // Right
    ];

    for (const dir of directions) {
      const nx = current.x + dir.x;
      const ny = current.y + dir.y;

      if (nx < 0 || nx >= 80 || ny < 0 || ny >= 80) continue;

      const nId = ny * 80 + nx;
      if (closedSet.has(nId)) continue;

      const tile = tiles[nId];

      // Rules:
      // - A tile is walkable if tile.walkable === true AND tile.buildingId === null
      // - Exception: the destination tile is always treated as reachable regardless of buildingId
      const isEnd = nx === end.x && ny === end.y;
      const isWalkable = tile.walkable && (tile.buildingId === null || isEnd);

      if (!isWalkable) continue;

      const gScore = current.g + 1;
      let neighborNode = openList.find((n) => n.id === nId);

      if (!neighborNode) {
        neighborNode = {
          x: nx,
          y: ny,
          g: gScore,
          h: getManhattanDistance({ x: nx, y: ny }, end),
          f: 0,
          id: nId,
          parent: current,
        };
        neighborNode.f = neighborNode.g + neighborNode.h;
        openList.push(neighborNode);
      } else if (gScore < neighborNode.g) {
        neighborNode.g = gScore;
        neighborNode.f = neighborNode.g + neighborNode.h;
        neighborNode.parent = current;
      }
    }
  }

  return []; // No path exists
}
