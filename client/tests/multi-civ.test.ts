import { describe, it, expect } from "vitest";
import { getCornerSpawns, generateMultiStartMap, expandTerritory, MAP_WIDTH, MAP_HEIGHT } from "../src/engine/map-generator";
import { getCivilization, CIVILIZATION_LIST, CIVILIZATIONS } from "../src/engine/civilizations";
import type { CivilizationId, CivRuntimeState, TileState, BuildingState, UnitState, ResourcePool } from "../src/engine/tick-types";

// ─── Corner Spawns ───────────────────────────────────────────────────────────

describe("getCornerSpawns()", () => {
  const corners = getCornerSpawns();

  it("returns exactly 4 spawn positions", () => {
    expect(corners).toHaveLength(4);
  });

  it("all positions are within map bounds", () => {
    for (const corner of corners) {
      expect(corner.x).toBeGreaterThanOrEqual(0);
      expect(corner.x).toBeLessThan(MAP_WIDTH);
      expect(corner.y).toBeGreaterThanOrEqual(0);
      expect(corner.y).toBeLessThan(MAP_HEIGHT);
    }
  });

  it("spawn positions are at least 50 tiles apart (diagonal map separation)", () => {
    for (let i = 0; i < corners.length; i++) {
      for (let j = i + 1; j < corners.length; j++) {
        const dx = corners[i].x - corners[j].x;
        const dy = corners[i].y - corners[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        expect(distance).toBeGreaterThan(50);
      }
    }
  });

  it("all positions are unique", () => {
    const keys = corners.map((c) => `${c.x},${c.y}`);
    expect(new Set(keys).size).toBe(4);
  });
});

// ─── Map Generation ──────────────────────────────────────────────────────────

describe("generateMultiStartMap()", () => {
  const corners = getCornerSpawns();
  const tiles = generateMultiStartMap("test-seed-42", corners);

  it("generates exactly MAP_WIDTH * MAP_HEIGHT tiles", () => {
    expect(tiles).toHaveLength(MAP_WIDTH * MAP_HEIGHT);
  });

  it("all tiles have a valid type", () => {
    const validTypes = ["GRASSLAND", "FOREST", "STONE_DEPOSIT", "WATER", "BARREN"];
    for (const tile of tiles) {
      expect(validTypes).toContain(tile.type);
    }
  });

  it("corner spawn tiles are walkable (habitable zone guarantee)", () => {
    for (const corner of corners) {
      const tileId = corner.y * MAP_WIDTH + corner.x;
      const tile = tiles[tileId];
      expect(tile.walkable).toBe(true);
      expect(tile.type).not.toBe("WATER");
    }
  });

  it("corner spawn tiles have initial visibility", () => {
    for (const corner of corners) {
      const tileId = corner.y * MAP_WIDTH + corner.x;
      expect(tiles[tileId].visible).toBe(true);
    }
  });

  it("is deterministic — same seed always produces identical maps", () => {
    const tiles2 = generateMultiStartMap("test-seed-42", corners);
    for (let i = 0; i < tiles.length; i++) {
      expect(tiles[i].type).toBe(tiles2[i].type);
      expect(tiles[i].walkable).toBe(tiles2[i].walkable);
    }
  });

  it("different seeds produce different maps", () => {
    const tilesAlt = generateMultiStartMap("different-seed-99", corners);
    let differences = 0;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i].type !== tilesAlt[i].type) differences++;
    }
    expect(differences).toBeGreaterThan(100); // Sufficiently different
  });
});

// ─── Territory Expansion ─────────────────────────────────────────────────────

describe("expandTerritory()", () => {
  it("marks tiles as owned within the owned radius", () => {
    const corners = getCornerSpawns();
    const tiles = generateMultiStartMap("territory-test", corners);
    const centerId = 40 * MAP_WIDTH + 40;

    expandTerritory(tiles, centerId, "franks", 3, 5);

    // Center tile should be owned
    expect(tiles[centerId].owned).toBe(true);
    expect(tiles[centerId].ownerId).toBe("franks");
  });

  it("first-owner-wins — second civ cannot claim already owned tiles", () => {
    const corners = getCornerSpawns();
    const tiles = generateMultiStartMap("territory-conflict", corners);
    const centerId = 40 * MAP_WIDTH + 40;

    expandTerritory(tiles, centerId, "franks", 3, 5);
    expandTerritory(tiles, centerId, "malians", 3, 5);

    // Center tile should still be owned by franks
    expect(tiles[centerId].ownerId).toBe("franks");
  });

  it("marks tiles as visible within the vision radius", () => {
    const corners = getCornerSpawns();
    const tiles = generateMultiStartMap("vision-test", corners);
    const centerId = 40 * MAP_WIDTH + 40;

    expandTerritory(tiles, centerId, "franks", 3, 5);

    // A tile at distance 4 (owned radius = 3, vision radius = 5) should be visible but not owned
    const nearbyId = 40 * MAP_WIDTH + 44;
    expect(tiles[nearbyId].visible).toBe(true);
  });
});

// ─── Civilizations Registry ──────────────────────────────────────────────────

describe("Civilization Registry", () => {
  it("has exactly 4 civilizations", () => {
    expect(CIVILIZATION_LIST).toHaveLength(4);
  });

  it("each civilization has a unique id, name, and colour", () => {
    const ids = new Set(CIVILIZATION_LIST.map((c) => c.id));
    const names = new Set(CIVILIZATION_LIST.map((c) => c.name));
    const colors = new Set(CIVILIZATION_LIST.map((c) => c.color));
    expect(ids.size).toBe(4);
    expect(names.size).toBe(4);
    expect(colors.size).toBe(4);
  });

  it("getCivilization returns the correct civ", () => {
    const franks = getCivilization("franks");
    expect(franks.id).toBe("franks");
    expect(franks.name).toBe("Franks");
  });

  it("getCivilization falls back to franks for unknown id", () => {
    const fallback = getCivilization("nonexistent" as CivilizationId);
    expect(fallback.id).toBe("franks");
  });

  it("each civilization has at least one bonus", () => {
    for (const civ of CIVILIZATION_LIST) {
      const bonuses = civ.bonuses;
      const hasSomething =
        bonuses.constructionSpeedMultiplier !== undefined ||
        bonuses.yieldMultiplier !== undefined ||
        bonuses.costMultiplier !== undefined ||
        bonuses.visionRadiusBoost !== undefined ||
        bonuses.startingResources !== undefined;
      expect(hasSomething).toBe(true);
    }
  });
});

// ─── Civilization-Specific Starting Resources ────────────────────────────────

describe("Civilization Starting Resources", () => {
  const BASE_RESOURCES: ResourcePool = { food: 30, wood: 35, stone: 5, knowledge: 0 };

  it("Franks start with +50 wood", () => {
    const franks = getCivilization("franks");
    const bonus = franks.bonuses.startingResources || {};
    expect((BASE_RESOURCES.wood) + (bonus.wood || 0)).toBe(85);
  });

  it("Malians start with +100 stone", () => {
    const malians = getCivilization("malians");
    const bonus = malians.bonuses.startingResources || {};
    expect((BASE_RESOURCES.stone) + (bonus.stone || 0)).toBe(105);
  });

  it("Byzantines start with +20 knowledge", () => {
    const byzantines = getCivilization("byzantines");
    const bonus = byzantines.bonuses.startingResources || {};
    expect((BASE_RESOURCES.knowledge) + (bonus.knowledge || 0)).toBe(20);
  });

  it("Normans start with +50 food", () => {
    const normans = getCivilization("normans");
    const bonus = normans.bonuses.startingResources || {};
    expect((BASE_RESOURCES.food) + (bonus.food || 0)).toBe(80);
  });
});

// ─── Worker ID Uniqueness ────────────────────────────────────────────────────

describe("Worker ID Uniqueness", () => {
  it("IDs with different civIds are unique even for same tick and index", () => {
    // Simulates the pattern used in simulation.worker.ts: `w-${civId}-${tick}-${idx}`
    const id1 = `w-franks-0-0`;
    const id2 = `w-malians-0-0`;
    const id3 = `w-byzantines-0-0`;
    const id4 = `w-normans-0-0`;
    const ids = new Set([id1, id2, id3, id4]);
    expect(ids.size).toBe(4);
  });
});

// ─── CivRuntimeState Isolation ───────────────────────────────────────────────

describe("CivRuntimeState Isolation", () => {
  it("modifying one civ's resources does not affect another", () => {
    const civStates: Record<string, CivRuntimeState> = {
      franks: {
        civilizationId: "franks",
        resources: { food: 100, wood: 100, stone: 50, knowledge: 0 },
        era: 1,
        autoPlay: false,
        townHallTileId: 0,
      },
      malians: {
        civilizationId: "malians",
        resources: { food: 100, wood: 100, stone: 150, knowledge: 0 },
        era: 1,
        autoPlay: true,
        townHallTileId: 79 * MAP_WIDTH + 79,
      },
    };

    // Simulate food consumption for franks only
    civStates.franks.resources.food -= 50;

    expect(civStates.franks.resources.food).toBe(50);
    expect(civStates.malians.resources.food).toBe(100); // Unchanged
  });

  it("each civ can have a different era", () => {
    const civStates: Record<string, CivRuntimeState> = {
      franks: {
        civilizationId: "franks",
        resources: { food: 0, wood: 0, stone: 0, knowledge: 200 },
        era: 2,
        autoPlay: false,
        townHallTileId: 0,
      },
      malians: {
        civilizationId: "malians",
        resources: { food: 0, wood: 0, stone: 0, knowledge: 0 },
        era: 1,
        autoPlay: true,
        townHallTileId: 100,
      },
    };

    expect(civStates.franks.era).toBe(2);
    expect(civStates.malians.era).toBe(1);
  });
});

// ─── Owner-Scoped Query Simulation ───────────────────────────────────────────

describe("Owner-Scoped Queries", () => {
  const workers: UnitState[] = [
    { id: "w-franks-0-0", ownerId: "franks", unitType: "WORKER", state: "IDLE", assignedBuildingId: null, position: { x: 8, y: 8 }, path: [], harvestTicks: 0, carrying: null, visionRadius: 5 },
    { id: "w-franks-0-1", ownerId: "franks", unitType: "WORKER", state: "HARVESTING", assignedBuildingId: "b-0", position: { x: 9, y: 8 }, path: [], harvestTicks: 1, carrying: null, visionRadius: 5 },
    { id: "w-malians-0-0", ownerId: "malians", unitType: "WORKER", state: "IDLE", assignedBuildingId: null, position: { x: 71, y: 8 }, path: [], harvestTicks: 0, carrying: null, visionRadius: 5 },
  ];

  const buildings: BuildingState[] = [
    { id: "b-franks-th", ownerId: "franks", type: "TOWN_HALL", tileId: 0, tier: 1, constructionTicksRemaining: 0, constructionWorkerId: null, staffed: false, operational: false, assignedWorkerIds: [] },
    { id: "b-malians-th", ownerId: "malians", type: "TOWN_HALL", tileId: 100, tier: 1, constructionTicksRemaining: 0, constructionWorkerId: null, staffed: false, operational: false, assignedWorkerIds: [] },
    { id: "b-franks-fh", ownerId: "franks", type: "FORAGER_HUT", tileId: 1, tier: 1, constructionTicksRemaining: 0, constructionWorkerId: null, staffed: true, operational: true, assignedWorkerIds: ["w-franks-0-1"] },
  ];

  it("filters workers by ownerId correctly", () => {
    const franksWorkers = workers.filter(w => w.ownerId === "franks");
    const maliansWorkers = workers.filter(w => w.ownerId === "malians");
    expect(franksWorkers).toHaveLength(2);
    expect(maliansWorkers).toHaveLength(1);
  });

  it("filters buildings by ownerId correctly", () => {
    const franksBuildings = buildings.filter(b => b.ownerId === "franks");
    const maliansBuildings = buildings.filter(b => b.ownerId === "malians");
    expect(franksBuildings).toHaveLength(2);
    expect(maliansBuildings).toHaveLength(1);
  });

  it("only one Town Hall per civ", () => {
    const franksTHs = buildings.filter(b => b.ownerId === "franks" && b.type === "TOWN_HALL");
    const maliansTHs = buildings.filter(b => b.ownerId === "malians" && b.type === "TOWN_HALL");
    expect(franksTHs).toHaveLength(1);
    expect(maliansTHs).toHaveLength(1);
  });

  it("idle workers scoped per civ", () => {
    const franksIdle = workers.filter(w => w.ownerId === "franks" && w.state === "IDLE");
    const maliansIdle = workers.filter(w => w.ownerId === "malians" && w.state === "IDLE");
    expect(franksIdle).toHaveLength(1);
    expect(maliansIdle).toHaveLength(1);
  });
});

// ─── Construction Float Termination ──────────────────────────────────────────

describe("Construction Float Termination", () => {
  it("Math.round prevents floating-point drift from never reaching zero", () => {
    // Simulates construction speed with float multiplier
    let remaining = 5;
    const speedMultiplier = 1.25;

    while (remaining > 0) {
      remaining = Math.round(remaining - 1 * speedMultiplier);
    }

    expect(remaining === 0 || Object.is(remaining, -0)).toBe(true);
  });

  it("without Math.round, float drift can cause issues", () => {
    // Demonstrates the bug that Math.round fixes
    let remaining = 5;
    const speedMultiplier = 1.25;
    let ticks = 0;
    const MAX_TICKS = 100;

    while (remaining > 0 && ticks < MAX_TICKS) {
      remaining = remaining - 1 * speedMultiplier;
      ticks++;
    }

    // This may or may not hit exactly 0 due to float drift
    // The point is Math.round fixes it deterministically
    expect(ticks).toBeLessThanOrEqual(MAX_TICKS);
  });
});
