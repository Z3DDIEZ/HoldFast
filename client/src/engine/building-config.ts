import type { BuildingType, ResourcePool, ResourceType, UnitType } from "./tick-types";

export interface BuildingConfig {
  id: BuildingType;
  name: string;
  resource: ResourceType | null;
  ticksToHarvest: number;
  yieldAmount: number;
  constructionTicks: number;
  requiredWorkers: number;
  requiredEra: 1 | 2 | 3 | 4;
  cost: Partial<ResourcePool>;
  produces: UnitType[];
}

export const UNIT_CONFIG: Record<UnitType, { cost: Partial<ResourcePool>; visionRadius: number }> = {
  WORKER: { cost: { food: 50 }, visionRadius: 2 },
  SCOUT: { cost: { food: 80, wood: 20 }, visionRadius: 5 },
};

export const BUILDING_CONFIG: Record<BuildingType, BuildingConfig> = {
  TOWN_HALL: {
    id: "TOWN_HALL",
    name: "Town Hall",
    resource: null,
    ticksToHarvest: 0,
    yieldAmount: 0,
    constructionTicks: 0,
    requiredWorkers: 0,
    requiredEra: 1,
    cost: {},
    produces: ["WORKER"],
  },
  FORAGER_HUT: {
    id: "FORAGER_HUT",
    name: "Forager Hut",
    resource: "food",
    ticksToHarvest: 2,
    yieldAmount: 5,
    constructionTicks: 3,
    requiredWorkers: 1,
    requiredEra: 1,
    cost: { wood: 5 },
    produces: [],
  },
  LUMBER_MILL: {
    id: "LUMBER_MILL",
    name: "Lumber Mill",
    resource: "wood",
    ticksToHarvest: 3,
    yieldAmount: 4,
    constructionTicks: 3,
    requiredWorkers: 1,
    requiredEra: 1,
    cost: { stone: 5 },
    produces: [],
  },
  QUARRY: {
    id: "QUARRY",
    name: "Quarry",
    resource: "stone",
    ticksToHarvest: 4,
    yieldAmount: 3,
    constructionTicks: 3,
    requiredWorkers: 1,
    requiredEra: 1,
    cost: { wood: 5 },
    produces: [],
  },
  STOREHOUSE: {
    id: "STOREHOUSE",
    name: "Storehouse",
    resource: null,
    ticksToHarvest: 0,
    yieldAmount: 0,
    constructionTicks: 4,
    requiredWorkers: 0,
    requiredEra: 1,
    cost: { wood: 15, stone: 5 },
    produces: [],
  },
  FARM: {
    id: "FARM",
    name: "Farm",
    resource: "food",
    ticksToHarvest: 2,
    yieldAmount: 10,
    constructionTicks: 4,
    requiredWorkers: 2,
    requiredEra: 2,
    cost: { wood: 20, stone: 10 },
    produces: [],
  },
  LIBRARY: {
    id: "LIBRARY",
    name: "Library",
    resource: "knowledge",
    ticksToHarvest: 4,
    yieldAmount: 3,
    constructionTicks: 5,
    requiredWorkers: 1,
    requiredEra: 1,
    cost: { wood: 25, stone: 20 },
    produces: [],
  },
  BARRACKS: {
    id: "BARRACKS",
    name: "Barracks",
    resource: null,
    ticksToHarvest: 0,
    yieldAmount: 0,
    constructionTicks: 6,
    requiredWorkers: 0,
    requiredEra: 3,
    cost: { wood: 30, stone: 30 },
    produces: ["SCOUT"],
  },
};

export const BUILDING_LIST: BuildingConfig[] = Object.values(BUILDING_CONFIG);
