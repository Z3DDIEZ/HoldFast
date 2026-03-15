import { useGameStore } from "../state/game-store";

/** Era names and descriptions matching PRD §3. */
const ERA_INFO = {
  1: {
    name: "FOUNDING",
    description: "Basic resource extraction",
    unlocks: ["Forager Hut", "Lumber Mill", "Quarry", "Storehouse", "Library"],
  },
  2: {
    name: "SETTLEMENT",
    description: "Agriculture & knowledge",
    unlocks: ["Farm", "Storehouse upgrades"],
  },
  3: {
    name: "FORTIFICATION",
    description: "Defence & advanced production",
    unlocks: ["Barracks", "Walls", "Production multipliers"],
  },
  4: {
    name: "IMPERIAL",
    description: "Global dominance & infinite scaling",
    unlocks: ["Efficiency Upgrades", "Population Expansion"],
  },
} as const;

/** Knowledge cost and population gate per era transition. */
const ERA_REQUIREMENTS = {
  1: { knowledge: 50, workers: 3 },
  2: { knowledge: 200, workers: 8 },
  3: { knowledge: 1000, workers: 20 },
} as const;

/** Worker state display colours. */
const WORKER_STATE_COLORS: Record<string, string> = {
  IDLE: "#888870",
  MOVING_TO_CONSTRUCT: "#c8a020",
  CONSTRUCTING: "#c8a020",
  MOVING_TO_HARVEST: "#4a8f3f",
  HARVESTING: "#c8a020",
  MOVING_TO_DEPOSIT: "#6a60c0",
  DEPOSITING: "#4aaf4a",
  WAITING: "#c8a020",
  STARVING: "#c04040",
};

/**
 * Left-side HUD panel showing era info, progression requirements,
 * worker breakdown, and research action.
 */
export function EraPanel() {
  const era = useGameStore((s) => s.era);
  const resources = useGameStore((s) => s.resources);
  const workers = useGameStore((s) => s.workers);
  const researchEra = useGameStore((s) => s.researchEra);
  const spawnWorker = useGameStore((s) => s.spawnWorker);
  const hasTownHall = useGameStore((s) => s.buildings.some((b) => b.type === "TOWN_HALL"));

  const info = ERA_INFO[era as 1 | 2 | 3 | 4];
  const isMaxEra = era === 4;

  const reqs = !isMaxEra ? ERA_REQUIREMENTS[era as 1 | 2 | 3] : null;

  const canResearch =
    reqs &&
    resources.knowledge >= reqs.knowledge &&
    workers.length >= reqs.workers;

  // Count workers by state
  const stateCounts: Record<string, number> = {};
  workers.forEach((w) => {
    stateCounts[w.state] = (stateCounts[w.state] || 0) + 1;
  });

  return (
    <div className="fixed left-3 top-1/2 -translate-y-1/2 w-[220px] bg-[#0f0f0f]/80 border border-[#ffffff10] backdrop-blur-[12px] rounded-xl shadow-2xl p-4 flex flex-col gap-4 z-40">
      {/* Era header */}
      <div className="flex flex-col gap-1.5 border-b border-[#ffffff10] pb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor:
                era === 1 ? "#c8a020" : era === 2 ? "#4a8f3f" : era === 3 ? "#c04040" : "#6a60c0",
              boxShadow: `0 0 10px ${era === 1 ? "#c8a02080" : era === 2 ? "#4a8f3f80" : era === 3 ? "#c0404080" : "#6a60c080"}`,
            }}
          />
          <span className="font-bold tracking-widest text-[#e8e8d0]" style={{ fontSize: "11px" }}>ERA {era}</span>
          <span className="ml-auto text-[#888870] font-medium" style={{ fontSize: "8px" }}>{info.name}</span>
        </div>
        <p className="text-[#555550] leading-snug" style={{ fontSize: "8px" }}>
          {info.description}
        </p>
      </div>

      {/* Progression requirements */}
      {!isMaxEra && reqs ? (
        <div className="flex flex-col gap-3 border-b border-[#ffffff10] pb-4">
          <span className="text-[#888870] font-bold tracking-tighter" style={{ fontSize: "8px" }}>
            PROGRESSION REQUIREMENTS
          </span>

          {/* Knowledge bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-end">
              <span className="font-bold text-[#6a60c0]" style={{ fontSize: "8px" }}>
                KNOWLEDGE
              </span>
              <span
                style={{
                  color:
                    resources.knowledge >= reqs.knowledge
                      ? "#4aaf4a"
                      : "#e8e8d0",
                  fontSize: "9px",
                  fontWeight: "700"
                }}
              >
                {resources.knowledge}<span className="text-[#555550] font-medium ml-1">/ {reqs.knowledge}</span>
              </span>
            </div>
            <div className="w-full h-[6px] bg-[#ffffff05] rounded-full border border-[#ffffff08] overflow-hidden">
              <div
                className="h-full bg-[#6a60c0] shadow-[0_0_8px_rgba(106,96,192,0.4)] transition-all duration-500 rounded-full"
                style={{
                  width: `${Math.min(100, (resources.knowledge / reqs.knowledge) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Population */}
          <div className="flex justify-between items-center bg-[#ffffff05] px-2 py-1.5 rounded border border-[#ffffff08]">
            <span className="font-bold text-[#888870]" style={{ fontSize: "8px" }}>POPULATION</span>
            <span
              className="font-bold"
              style={{
                color: workers.length >= reqs.workers ? "#4aaf4a" : "#e8e8d0",
                fontSize: "9px",
              }}
            >
              {workers.length} <span className="text-[#555550] font-medium ml-0.5">/ {reqs.workers}</span>
            </span>
          </div>

          {/* Research button */}
          <button
            className={`mt-1 w-full py-2 rounded-lg border font-bold transition-all ${
              canResearch
                ? "border-[#6a60c0] bg-[#6a60c010] text-[#8b84d7] hover:bg-[#6a60c020] hover:border-[#8b84d7] cursor-pointer active:scale-95"
                : "border-[#ffffff08] bg-transparent text-[#555550] opacity-50 cursor-not-allowed"
            }`}
            style={{ fontSize: "9px", letterSpacing: "0.05em" }}
            onClick={() => {
              if (canResearch) {
                researchEra((era + 1) as 2 | 3 | 4);
              }
            }}
            disabled={!canResearch}
          >
            ADVANCE SETTLEMENT
          </button>
        </div>
      ) : (
        <div className="border-b border-[#ffffff10] pb-4 flex items-center justify-center">
          <div className="px-3 py-1 rounded bg-[#c8a02010] border border-[#c8a02040]">
            <span className="font-bold text-[#c8a020] uppercase tracking-tighter" style={{ fontSize: "8px" }}>
              ★ Imperial Hegemony Reached
            </span>
          </div>
        </div>
      )}

      {/* Worker status breakdown */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[#888870] font-bold tracking-tighter" style={{ fontSize: "8px" }}>
            UNIT STATUS
          </span>
          <span className="px-1.5 rounded bg-[#ffffff05] border border-[#ffffff08] text-[#e8e8d0] font-bold" style={{ fontSize: "8px" }}>
            {workers.length}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-1.5">
          {Object.entries(stateCounts).map(([wState, count]) => (
            <div key={wState} className="flex items-center gap-1.5 bg-[#ffffff03] px-1.5 py-1 rounded border border-transparent hover:border-[#ffffff08] transition-all">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: WORKER_STATE_COLORS[wState] || "#888870",
                  boxShadow: `0 0 4px ${WORKER_STATE_COLORS[wState]}40`
                }}
              />
              <span className="truncate text-[#888870] font-medium" style={{ fontSize: "7px" }}>
                {count} {wState.replace(/_/g, " ")}
              </span>
            </div>
          ))}
        </div>

        {workers.length === 0 && (
          <p className="text-[#555550] italic text-center py-2" style={{ fontSize: "7px" }}>
            Establish Town Hall to begin
          </p>
        )}
        
        {hasTownHall && (
          <button
            className={`mt-2 w-full py-1.5 rounded-lg border font-bold transition-all ${
              resources.food >= 50
                ? "border-[#4a8f3f80] bg-[#4a8f3f10] text-[#e8e8d0] hover:bg-[#4a8f3f20] cursor-pointer"
                : "border-[#ffffff08] bg-transparent text-[#555550] opacity-50 cursor-not-allowed"
            }`}
            style={{ fontSize: "8px" }}
            onClick={() => {
              if (resources.food >= 50) spawnWorker();
            }}
            disabled={resources.food < 50}
          >
            TRAIN WORKER <span className="text-[#4a8f3f] ml-1">50F</span>
          </button>
        )}
      </div>

      {/* Unlocked buildings */}
      <div className="flex flex-col gap-1.5 mt-auto bg-[#ffffff03] p-2 rounded-lg border border-[#ffffff05]">
        <span className="text-[#555550] font-bold tracking-tight uppercase" style={{ fontSize: "7px" }}>
          Current Tier Unlocks
        </span>
        <div className="flex flex-wrap gap-x-2 gap-y-1">
          {info.unlocks.map((name) => (
            <span key={name} className="text-[#888870] flex items-center gap-1" style={{ fontSize: "7px" }}>
              <div className="w-[2px] h-[2px] rounded-full bg-[#888870]" /> {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
