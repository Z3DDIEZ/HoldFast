import type { BuildingType, ResourcePool, ResourceType } from "./tick-types";

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
}

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
    cost: { wood: 10 },
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
    cost: { wood: 5, stone: 5 },
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
    cost: { wood: 8 },
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
  },
};

export const BUILDING_LIST: BuildingConfig[] = [
  BUILDING_CONFIG.TOWN_HALL,
  BUILDING_CONFIG.FORAGER_HUT,
  BUILDING_CONFIG.LUMBER_MILL,
  BUILDING_CONFIG.QUARRY,
  BUILDING_CONFIG.STOREHOUSE,
  BUILDING_CONFIG.FARM,
  BUILDING_CONFIG.LIBRARY,
  BUILDING_CONFIG.BARRACKS,
];
