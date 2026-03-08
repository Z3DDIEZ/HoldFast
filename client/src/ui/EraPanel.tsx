import { useGameStore } from "../state/game-store";

export function EraPanel() {
  const era = useGameStore((s) => s.era);
  const resources = useGameStore((s) => s.resources);

  const eraNames: Record<number, string> = {
    1: "FOUNDING",
    2: "SETTLEMENT",
    3: "FORTIFICATION",
  };

  const maxKnowledge = era === 1 ? 100 : era === 2 ? 500 : 1;
  const progressPercent = Math.min(
    100,
    Math.max(0, (resources.knowledge / maxKnowledge) * 100),
  );

  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 w-[200px] bg-[#0f0f0fCC] p-4 flex flex-col gap-2 z-40">
      <span style={{ color: "#e8e8d0", fontSize: "10px" }}>ERA {era}</span>
      <span style={{ color: "#888870", fontSize: "8px" }}>{eraNames[era]}</span>

      <div className="mt-2 w-full">
        {era === 3 ? (
          <span style={{ color: "#e8e8d0", fontSize: "8px" }}>MAX ERA</span>
        ) : (
          <div className="w-full h-[8px] bg-[#2a2a2a]">
            <div
              className="h-full bg-[#6a60c0]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
