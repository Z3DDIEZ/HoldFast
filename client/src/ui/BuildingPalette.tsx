import { useGameStore } from "../state/game-store";
import { BUILDING_LIST } from "../engine/building-config";
import type { ResourcePool } from "../state/types";

const BUILDINGS = BUILDING_LIST;

/** Resource accent colours from the PRD HUD palette. */
const RESOURCE_COLORS: Record<string, string> = {
  food: "#c8a020",
  wood: "#4a8f3f",
  stone: "#909090",
  knowledge: "#6a60c0",
};

/** Check if the player can afford a building's construction cost. */
function canAfford(
  cost: Partial<ResourcePool>,
  resources: ResourcePool,
): boolean {
  for (const [key, amount] of Object.entries(cost)) {
    if (resources[key as keyof ResourcePool] < (amount || 0)) return false;
  }
  return true;
}

/**
 * Bottom-bar HUD displaying available buildings as cards with
 * cost, production info, era locks, and affordability indicators.
 */
export function BuildingPalette() {
  const currentEra = useGameStore((s) => s.era);
  const resources = useGameStore((s) => s.resources);
  const selectedBuilding = useGameStore((s) => s.selectedBuilding);
  const selectBuilding = useGameStore((s) => s.selectBuilding);
  const hasTownHall = useGameStore((s) =>
    s.buildings.some((b) => b.type === "TOWN_HALL"),
  );

  return (
    <div className="fixed bottom-0 left-0 w-full h-[96px] z-50 flex flex-row items-center px-3 gap-2 bg-[#0f0f0f]/95 border-t border-[#2a2a2a] backdrop-blur-sm overflow-x-auto">
      {BUILDINGS.map((b) => {
        const isTownHallPlaced = b.id === "TOWN_HALL" && hasTownHall;
        const isLocked = b.requiredEra > currentEra || isTownHallPlaced;
        const isSelected = selectedBuilding === b.id;
        const affordable = canAfford(b.cost, resources);
        const isDisabled = isLocked || !affordable;

        return (
          <div
            key={b.id}
            className={`
              flex-shrink-0 flex flex-col items-center justify-between
              w-[80px] h-[80px] p-2 relative select-none
              border transition-all duration-150
              ${isLocked ? "opacity-30 cursor-not-allowed" : ""}
              ${!isLocked && !affordable ? "opacity-60 cursor-not-allowed" : ""}
              ${!isDisabled ? "cursor-pointer hover:border-[#888870] hover:bg-[#1a1a1a]" : ""}
              ${isSelected ? "border-[#e8e8d0] bg-[#1a1a1a] shadow-[0_0_8px_rgba(232,232,208,0.15)]" : "border-[#2a2a2a]"}
            `}
            onClick={() => {
              if (isLocked) return;
              if (!affordable) return;
              selectBuilding(isSelected ? null : b.id);
            }}
          >
            {/* Building name */}
            <span
              className="text-center leading-tight"
              style={{
                color: isSelected ? "#ffffff" : "#e8e8d0",
                fontSize: "7px",
              }}
            >
              {b.name}
            </span>

            {/* Production info */}
            {b.resource ? (
              <div className="flex items-center gap-1">
                <div
                  className="w-[5px] h-[5px]"
                  style={{
                    backgroundColor: RESOURCE_COLORS[b.resource] || "#888870",
                  }}
                />
                <span
                  style={{
                    fontSize: "6px",
                    color: RESOURCE_COLORS[b.resource] || "#888870",
                  }}
                >
                  +{b.yieldAmount}/{b.ticksToHarvest}t
                </span>
              </div>
            ) : b.id === "STOREHOUSE" ? (
              <span style={{ fontSize: "6px", color: "#888870" }}>
                +200 cap
              </span>
            ) : b.id === "TOWN_HALL" ? (
              <span style={{ fontSize: "6px", color: "#c8a020" }}>
                +3 workers
              </span>
            ) : (
              <span style={{ fontSize: "6px", color: "#555550" }}>passive</span>
            )}

            {/* Cost display */}
            <div className="flex items-center gap-1 flex-wrap justify-center">
              {Object.entries(b.cost).map(([resource, amount]) => (
                <span
                  key={resource}
                  style={{
                    fontSize: "6px",
                    color:
                      resources[resource as keyof ResourcePool] >= (amount || 0)
                        ? RESOURCE_COLORS[resource] || "#888870"
                        : "#c04040",
                  }}
                >
                  {amount} {resource[0]?.toUpperCase()}
                </span>
              ))}
              {Object.keys(b.cost).length === 0 && (
                <span style={{ fontSize: "6px", color: "#4aaf4a" }}>FREE</span>
              )}
            </div>

            {/* Era lock overlay */}
            {isLocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f0f]/80">
                <span style={{ color: "#c04040", fontSize: "7px" }}>
                  {isTownHallPlaced ? "PLACED" : `ERA ${b.requiredEra}`}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

