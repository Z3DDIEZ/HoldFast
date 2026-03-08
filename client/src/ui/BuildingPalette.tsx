import { useGameStore } from "../state/game-store";
import type { BuildingType } from "../state/types";

interface BuildingDef {
  id: BuildingType;
  name: string;
  requiredEra: number;
}

const BUILDINGS: BuildingDef[] = [
  { id: "TOWN_HALL", name: "Town Hall", requiredEra: 1 },
  { id: "FORAGER_HUT", name: "Forager Hut", requiredEra: 1 },
  { id: "LUMBER_MILL", name: "Lumber Mill", requiredEra: 1 },
  { id: "QUARRY", name: "Quarry", requiredEra: 1 },
  { id: "STOREHOUSE", name: "Storehouse", requiredEra: 1 },
  { id: "FARM", name: "Farm", requiredEra: 2 },
  { id: "LIBRARY", name: "Library", requiredEra: 2 },
  { id: "BARRACKS", name: "Barracks", requiredEra: 3 },
];

export function BuildingPalette() {
  const currentEra = useGameStore((s) => s.era);
  const selectedBuilding = useGameStore((s) => s.selectedBuilding);
  const selectBuilding = useGameStore((s) => s.selectBuilding);

  return (
    <div className="fixed bottom-0 left-0 w-full h-[96px] z-50 flex flex-row items-center px-4 gap-3 bg-[#0f0f0f] border-t border-[#2a2a2a] overflow-x-auto">
      {BUILDINGS.map((b) => {
        const isLocked = b.requiredEra > currentEra;
        const isSelected = selectedBuilding === b.id;

        return (
          <div
            key={b.id}
            className={`flex-shrink-0 flex items-center justify-center w-[64px] h-[72px] bg-[#0f0f0f] border relative select-none 
              ${isLocked ? "opacity-40" : "cursor-pointer hover:border-[#888870]"}
              ${isSelected ? "border-[#e8e8d0] bg-[#1a1a1a]" : "border-[#2a2a2a]"}
            `}
            onClick={() => {
              if (isLocked) return;
              if (isSelected) {
                selectBuilding(null);
              } else {
                selectBuilding(b.id);
              }
            }}
          >
            <span
              className="text-center px-1"
              style={{
                color: isSelected ? "#ffffff" : "#e8e8d0",
                fontSize: "8px",
                lineHeight: "1.4",
              }}
            >
              {b.name}
            </span>
            {isLocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0f0f0fCC]">
                <span style={{ color: "#c04040", fontSize: "8px" }}>
                  ERA {b.requiredEra}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
