import { useGameStore } from "../state/game-store";
import { BUILDING_LIST, BUILDING_CONFIG, UNIT_CONFIG } from "../engine/building-config";
import type { ResourcePool, UnitType } from "../engine/tick-types";

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
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 w-[98%] max-w-[1200px] h-[92px] z-50 flex flex-row items-center px-4 gap-3 bg-[#0f0f0f]/80 border border-[#ffffff10] backdrop-blur-[12px] rounded-xl shadow-2xl overflow-x-auto scroller-none">
      <div className="flex flex-col border-r border-[#ffffff10] pr-4 mr-1">
        <span className="text-[#888870] font-bold tracking-tighter" style={{ fontSize: "8px" }}>BUILD</span>
        <span className="text-[#555550]" style={{ fontSize: "6px" }}>PALETTE</span>
      </div>
      
      {BUILDINGS.map((b) => {
        const isTownHallPlaced = b.id === "TOWN_HALL" && hasTownHall;
        const isLocked = b.requiredEra > currentEra || isTownHallPlaced;
        const isSelected = selectedBuilding === b.id;
        const affordable = canAfford(b.cost, resources);
        const isDisabled = isLocked || !affordable;

        return (
          <button
            key={b.id}
            type="button"
            className={`
              flex-shrink-0 flex flex-col items-center justify-between
              w-[76px] h-[72px] p-2 relative select-none
              rounded-lg border transition-all duration-200
              ${isLocked ? "opacity-20 grayscale cursor-not-allowed" : ""}
              ${!isLocked && !affordable ? "opacity-50 cursor-not-allowed" : ""}
              ${!isDisabled ? "cursor-pointer hover:border-[#ffffff40] hover:bg-[#ffffff08] active:scale-95" : ""}
              ${isSelected ? "border-[#e8e8d0] bg-[#ffffff10] shadow-[0_0_15px_rgba(232,232,208,0.1)] scale-105 z-10" : "border-[#ffffff08] bg-[#ffffff03]"}
            `}
            onClick={() => {
              if (isLocked) return;
              if (!affordable) return;
              selectBuilding(isSelected ? null : b.id);
            }}
            disabled={isDisabled}
            aria-pressed={isSelected}
          >
            {/* Building name */}
            <span
              className="text-center font-bold tracking-tight"
              style={{
                color: isSelected ? "#ffffff" : "#e8e8d0",
                fontSize: "8px",
              }}
            >
              {b.name}
            </span>

            {/* Production info */}
            <div className="flex flex-col items-center gap-[1px]">
              {b.resource ? (
                <div className="flex items-center gap-1 bg-[#ffffff05] px-1 rounded">
                  <div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      backgroundColor: RESOURCE_COLORS[b.resource] || "#888870",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "6px",
                      fontWeight: "600",
                      color: RESOURCE_COLORS[b.resource] || "#888870",
                    }}
                  >
                    +{b.yieldAmount}
                  </span>
                </div>
              ) : b.id === "STOREHOUSE" ? (
                <span className="font-medium text-[#888870]" style={{ fontSize: "6px" }}>
                  +200 Cap
                </span>
              ) : b.id === "TOWN_HALL" ? (
                <span className="font-medium text-[#c8a020]" style={{ fontSize: "6px" }}>
                  Start
                </span>
              ) : (
                <span className="font-medium text-[#555550]" style={{ fontSize: "6px" }}>
                  Utility
                </span>
              )}
            </div>

            {/* Cost display */}
            <div className="flex items-center gap-1 flex-wrap justify-center border-t border-[#ffffff08] pt-1 w-full">
              {Object.entries(b.cost).map(([resource, amount]) => (
                <div key={resource} className="flex items-center gap-0.5">
                   <div
                    className="w-1 h-1 rounded-full"
                    style={{
                      backgroundColor: RESOURCE_COLORS[resource] || "#888870",
                    }}
                  />
                  <span
                    style={{
                      fontSize: "6px",
                      fontWeight: "700",
                      color:
                        resources[resource as keyof ResourcePool] >= (amount || 0)
                          ? "#e8e8d0"
                          : "#c04040",
                    }}
                  >
                    {amount}
                  </span>
                </div>
              ))}
              {Object.keys(b.cost).length === 0 && (
                <span style={{ fontSize: "6px", color: "#4aaf4a", fontWeight: "bold" }}>FREE</span>
              )}
            </div>

            {/* Era lock overlay */}
            {isLocked && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-[#000000a0] backdrop-blur-[1px]">
                <div className="px-1.5 py-0.5 rounded border border-[#ffffff20] bg-black/50">
                  <span style={{ color: "#ffffff", fontSize: "7px", fontWeight: "bold" }}>
                    {isTownHallPlaced ? "PLACED" : `ERA ${b.requiredEra}`}
                  </span>
                </div>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

function UnitProductionPanel() {
  const selectedBuildingId = useGameStore((s) => s.selectedBuildingId);
  const buildings = useGameStore((s) => s.buildings);
  const resources = useGameStore((s) => s.resources);
  const spawnUnit = useGameStore((s) => s.spawnUnit);

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId);
  if (!selectedBuilding || selectedBuilding.constructionTicksRemaining > 0) return null;

  const config = BUILDING_CONFIG[selectedBuilding.type];
  if (!config || !config.produces || config.produces.length === 0) return null;

  return (
    <div className="fixed bottom-[110px] right-[188px] flex flex-col gap-2 p-1 bg-[#0f0f0f]/80 border border-[#ffffff10] backdrop-blur-[12px] rounded-xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="px-3 py-1 border-b border-[#ffffff10] mb-1">
        <span className="text-[10px] text-[#e8e8d0] uppercase tracking-widest font-bold">Production</span>
      </div>
      <div className="flex flex-col gap-1 p-2">
        {config.produces.map(unitType => {
          const unitConfig = UNIT_CONFIG[unitType];
          const affordable = canAfford(unitConfig.cost, resources);
          
          return (
            <button
              key={unitType}
              disabled={!affordable}
              onClick={() => spawnUnit(selectedBuilding.id, unitType as UnitType)}
              className={`
                px-4 py-2 rounded-lg border transition-all text-left flex flex-col gap-1
                ${affordable ? "border-[#ffffff10] bg-[#ffffff05] hover:bg-[#ffffff10] hover:border-[#ffffff20] active:scale-[0.98]" : "border-[#40202050] bg-[#40202010] opacity-50 cursor-not-allowed"}
              `}
            >
              <div className="flex justify-between items-center w-full gap-4">
                <span className="uppercase font-bold text-[#e8e8d0] tracking-tight" style={{ fontSize: "9px" }}>{unitType}</span>
                <div className="flex gap-2">
                  {Object.entries(unitConfig.cost).map(([res, amt]) => (
                    <div key={res} className="flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full" style={{ backgroundColor: RESOURCE_COLORS[res] }} />
                      <span style={{ fontSize: "8px", fontWeight: "700", color: resources[res as keyof ResourcePool] >= (amt || 0) ? "#e8e8d0" : "#c04040" }}>
                        {amt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HUD() {
  return (
    <>
      <BuildingPalette />
      <UnitProductionPanel />
    </>
  );
}
