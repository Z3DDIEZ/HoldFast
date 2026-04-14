import type { Civilization, CivilizationId } from "./tick-types";

export const CIVILIZATIONS: Record<CivilizationId, Civilization> = {
  franks: {
    id: "franks",
    name: "Franks",
    description: "Master builders with a strong early economy. Faster construction and cheaper wood buildings.",
    color: "#3b82f6", // Blue
    bonuses: {
      constructionSpeedMultiplier: 1.25,
      costMultiplier: { wood: 0.9 },
      startingResources: { wood: 50 },
    },
  },
  malians: {
    id: "malians",
    name: "Malians",
    description: "Wealthy merchants focused on resource extraction. Higher stone and knowledge yields.",
    color: "#eab308", // Gold
    bonuses: {
      yieldMultiplier: { stone: 1.15, knowledge: 1.15 },
      startingResources: { stone: 100 },
    },
  },
  byzantines: {
    id: "byzantines",
    name: "Byzantines",
    description: "Architects of the classical world. Cheaper era research and superior libraries.",
    color: "#a855f7", // Purple
    bonuses: {
      yieldMultiplier: { knowledge: 1.2 },
      startingResources: { knowledge: 20 },
    },
  },
  normans: {
    id: "normans",
    name: "Normans",
    description: "Adventurous conquerors. Superior vision and cheaper military infrastructure.",
    color: "#ef4444", // Red
    bonuses: {
      visionRadiusBoost: 2,
      costMultiplier: { wood: 0.8, stone: 0.8 }, // Primarily for barracks in theory
      startingResources: { food: 50 },
    },
  },
};

export const CIVILIZATION_LIST: Civilization[] = Object.values(CIVILIZATIONS);

export function getCivilization(id: CivilizationId): Civilization {
  return CIVILIZATIONS[id] ?? CIVILIZATIONS.franks;
}
