import { useGameStore } from "../state/game-store";

/** Era names and descriptions matching PRD §3. */
const ERA_INFO = {
  1: {
    name: "FOUNDING",
    description: "Basic resource extraction",
    unlocks: ["Forager Hut", "Lumber Mill", "Quarry", "Storehouse"],
  },
  2: {
    name: "SETTLEMENT",
    description: "Agriculture & knowledge",
    unlocks: ["Farm", "Library", "Storehouse upgrades"],
  },
  3: {
    name: "FORTIFICATION",
    description: "Defence & advanced production",
    unlocks: ["Barracks", "Walls", "Production multipliers"],
  },
} as const;

/** Knowledge cost and population gate per era transition. */
const ERA_REQUIREMENTS = {
  1: { knowledge: 50, workers: 3 },
  2: { knowledge: 200, workers: 8 },
} as const;

/** Worker state display colours. */
const WORKER_STATE_COLORS: Record<string, string> = {
  IDLE: "#888870",
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

  const info = ERA_INFO[era];
  const isMaxEra = era === 3;

  const reqs = !isMaxEra ? ERA_REQUIREMENTS[era as 1 | 2] : null;

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
    <div className="fixed left-0 top-1/2 -translate-y-1/2 w-[200px] bg-[#0f0f0f]/90 border-r border-[#2a2a2a] backdrop-blur-sm p-4 flex flex-col gap-3 z-40">
      {/* Era header */}
      <div className="flex flex-col gap-1 border-b border-[#2a2a2a] pb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2"
            style={{
              backgroundColor:
                era === 1 ? "#c8a020" : era === 2 ? "#4a8f3f" : "#c04040",
              boxShadow: `0 0 6px ${era === 1 ? "#c8a020" : era === 2 ? "#4a8f3f" : "#c04040"}`,
            }}
          />
          <span style={{ color: "#e8e8d0", fontSize: "10px" }}>ERA {era}</span>
        </div>
        <span style={{ color: "#888870", fontSize: "8px" }}>{info.name}</span>
        <span style={{ color: "#555550", fontSize: "7px" }}>
          {info.description}
        </span>
      </div>

      {/* Progression requirements */}
      {!isMaxEra && reqs ? (
        <div className="flex flex-col gap-2 border-b border-[#2a2a2a] pb-3">
          <span style={{ color: "#888870", fontSize: "7px" }}>
            NEXT ERA REQUIRES
          </span>

          {/* Knowledge bar */}
          <div className="flex flex-col gap-1">
            <div className="flex justify-between">
              <span style={{ color: "#6a60c0", fontSize: "7px" }}>
                KNOWLEDGE
              </span>
              <span
                style={{
                  color:
                    resources.knowledge >= reqs.knowledge
                      ? "#4aaf4a"
                      : "#e8e8d0",
                  fontSize: "8px",
                }}
              >
                {resources.knowledge}/{reqs.knowledge}
              </span>
            </div>
            <div className="w-full h-[4px] bg-[#2a2a2a]">
              <div
                className="h-full bg-[#6a60c0] transition-all duration-300"
                style={{
                  width: `${Math.min(100, (resources.knowledge / reqs.knowledge) * 100)}%`,
                }}
              />
            </div>
          </div>

          {/* Population */}
          <div className="flex justify-between">
            <span style={{ color: "#888870", fontSize: "7px" }}>WORKERS</span>
            <span
              style={{
                color: workers.length >= reqs.workers ? "#4aaf4a" : "#e8e8d0",
                fontSize: "8px",
              }}
            >
              {workers.length}/{reqs.workers}
            </span>
          </div>

          {/* Research button */}
          <button
            className={`mt-1 w-full py-1 border text-center transition-all ${
              canResearch
                ? "border-[#6a60c0] bg-[#6a60c0]/20 hover:bg-[#6a60c0]/40 cursor-pointer"
                : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
            }`}
            style={{ fontSize: "8px", color: "#e8e8d0" }}
            onClick={() => {
              if (canResearch) {
                researchEra((era + 1) as 2 | 3);
              }
            }}
            disabled={!canResearch}
          >
            ADVANCE ERA
          </button>
        </div>
      ) : (
        <div className="border-b border-[#2a2a2a] pb-3">
          <span style={{ color: "#c8a020", fontSize: "8px" }}>
            ★ MAX ERA REACHED
          </span>
        </div>
      )}

      {/* Worker status breakdown */}
      <div className="flex flex-col gap-1">
        <span style={{ color: "#888870", fontSize: "7px" }}>
          WORKERS ({workers.length})
        </span>
        {Object.entries(stateCounts).map(([wState, count]) => (
          <div key={wState} className="flex items-center gap-2">
            <div
              className="w-[6px] h-[6px]"
              style={{
                backgroundColor: WORKER_STATE_COLORS[wState] || "#888870",
              }}
            />
            <span style={{ color: "#888870", fontSize: "7px" }}>
              {count}× {wState.replace(/_/g, " ")}
            </span>
          </div>
        ))}
        {workers.length === 0 && (
          <span style={{ color: "#555550", fontSize: "7px" }}>
            Place Town Hall to start
          </span>
        )}
        
        {hasTownHall && (
          <button
            className={`mt-1 w-full py-1 border text-center transition-all ${
              resources.food >= 50
                ? "border-[#4a8f3f] bg-[#4a8f3f]/20 hover:bg-[#4a8f3f]/40 cursor-pointer"
                : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
            }`}
            style={{ fontSize: "8px", color: resources.food >= 50 ? "#e8e8d0" : "#888870" }}
            onClick={() => {
              if (resources.food >= 50) spawnWorker();
            }}
            disabled={resources.food < 50}
          >
            SPAWN WORKER (50 FOOD)
          </button>
        )}
      </div>

      {/* Unlocked buildings */}
      <div className="flex flex-col gap-1 mt-1">
        <span style={{ color: "#555550", fontSize: "7px" }}>
          ERA {era} UNLOCKS
        </span>
        {info.unlocks.map((name) => (
          <span key={name} style={{ color: "#888870", fontSize: "7px" }}>
            · {name}
          </span>
        ))}
      </div>
    </div>
  );
}
