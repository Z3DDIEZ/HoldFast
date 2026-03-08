import type { TileState } from "../state/types";

interface Node {
  x: number;
  y: number;
  g: number; // Cost from start
  h: number; // Heuristic to end
  f: number; // Total cost
  parent: Node | null;
}

const MAP_SIZE = 80;

function getHeuristic(x1: number, y1: number, x2: number, y2: number): number {
  // Manhattan distance for grid movement
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

export function findPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  tiles: TileState[],
): { x: number; y: number }[] {
  if (startX === endX && startY === endY) return [];

  const openList: Node[] = [];
  const closedSet = new Set<string>();

  const startNode: Node = {
    x: startX,
    y: startY,
    g: 0,
    h: getHeuristic(startX, startY, endX, endY),
    f: 0,
    parent: null,
  };
  startNode.f = startNode.g + startNode.h;

  openList.push(startNode);

  while (openList.length > 0) {
    // Sort open list by f score - lowest first
    openList.sort((a, b) => a.f - b.f);
    const current = openList.shift()!;

    if (current.x === endX && current.y === endY) {
      // Reconstruct path
      const path: { x: number; y: number }[] = [];
      let temp: Node | null = current;
      while (temp.parent) {
        path.push({ x: temp.x, y: temp.y });
        temp = temp.parent;
      }
      return path.reverse();
    }

    const key = `${current.x},${current.y}`;
    closedSet.add(key);

    // Adjacent tiles (up, down, left, right)
    const neighbors = [
      { x: current.x, y: current.y - 1 },
      { x: current.x, y: current.y + 1 },
      { x: current.x - 1, y: current.y },
      { x: current.x + 1, y: current.y },
    ];

    for (const neighbor of neighbors) {
      if (
        neighbor.x < 0 ||
        neighbor.x >= MAP_SIZE ||
        neighbor.y < 0 ||
        neighbor.y >= MAP_SIZE
      )
        continue;
      if (closedSet.has(`${neighbor.x},${neighbor.y}`)) continue;

      const tile = tiles[neighbor.y * MAP_SIZE + neighbor.x];
      // Pathfinding constraint: Water and Stone Deposits are impassable for now
      if (tile.type === "water") continue;

      const gScore = current.g + 1; // uniform cost

      let neighborNode = openList.find(
        (n) => n.x === neighbor.x && n.y === neighbor.y,
      );

      if (!neighborNode) {
        neighborNode = {
          x: neighbor.x,
          y: neighbor.y,
          g: gScore,
          h: getHeuristic(neighbor.x, neighbor.y, endX, endY),
          f: 0,
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

  return []; // No path found
}
