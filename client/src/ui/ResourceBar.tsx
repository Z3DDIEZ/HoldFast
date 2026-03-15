import { useGameStore } from "../state/game-store";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

/** Pixel-art style resource icons matching the HUD accent colours. */
const Icons = {
  /** Wheat/grain icon for food resource. */
  Food: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="7" y="8" width="2" height="7" />
      <rect x="5" y="4" width="2" height="4" />
      <rect x="9" y="4" width="2" height="4" />
      <rect x="3" y="1" width="2" height="3" />
      <rect x="7" y="1" width="2" height="3" />
      <rect x="11" y="1" width="2" height="3" />
    </svg>
  ),
  /** Log/tree icon for wood resource. */
  Wood: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="2" y="6" width="12" height="4" rx="1" />
      <rect x="3" y="2" width="10" height="4" rx="1" opacity="0.7" />
      <rect x="4" y="10" width="8" height="4" rx="1" opacity="0.5" />
    </svg>
  ),
  /** Rock/crystal icon for stone resource. */
  Stone: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <path d="M8 1L2 7L4 14H12L14 7L8 1Z" />
      <path d="M8 1L5 8L8 14" opacity="0.6" />
    </svg>
  ),
  /** Book/scroll icon for knowledge resource. */
  Knowledge: () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
      <rect x="3" y="2" width="10" height="12" rx="1" />
      <rect x="5" y="4" width="6" height="1" opacity="0.5" />
      <rect x="5" y="6" width="6" height="1" opacity="0.5" />
      <rect x="5" y="8" width="4" height="1" opacity="0.5" />
      <rect x="2" y="2" width="2" height="12" opacity="0.6" />
    </svg>
  ),
};

/**
 * Formats a delta value as "+N" or "-N" with the appropriate colour.
 * Zero deltas show as dim grey.
 */
function DeltaIndicator({ value }: { value: number }) {
  if (value === 0) {
    return <span style={{ color: "#555550", fontSize: "7px" }}>+0</span>;
  }
  const isPositive = value > 0;
  return (
    <span
      style={{
        color: isPositive ? "#4aaf4a" : "#c04040",
        fontSize: "7px",
      }}
    >
      {isPositive ? `+${value}` : `${value}`}
    </span>
  );
}

/** Single resource display with icon, value, delta, and label. */
function ResourceItem({
  color,
  value,
  delta,
  label,
  icon,
}: {
  color: string;
  value: number;
  delta: number;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 border border-transparent hover:border-[#2a2a2a] transition-colors">
      <div
        className="w-4 h-4 flex items-center justify-center"
        style={{ color }}
      >
        {icon}
      </div>
      <div className="flex flex-col">
        <div className="flex items-center gap-1">
          <span style={{ color, fontSize: "10px", fontWeight: "bold" }}>
            {value}
          </span>
          <DeltaIndicator value={delta} />
        </div>
        <span style={{ color: "#888870", fontSize: "7px" }}>{label}</span>
      </div>
    </div>
  );
}

/**
 * Top-bar HUD displaying resource totals, per-tick deltas,
 * tick counter, and save status.
 */
export function ResourceBar() {
  const resources = useGameStore((s) => s.resources);
  const resourceDelta = useGameStore((s) => s.resourceDelta);
  const saveStatus = useGameStore((s) => s.saveStatus);
  const savedAt = useGameStore((s) => s.savedAt);
  const tickCount = useGameStore((s) => s.tickCount);
  const simSpeed = useGameStore((s) => s.simSpeed);
  const setSimSpeed = useGameStore((s) => s.setSimSpeed);
  const isPaused = useGameStore((s) => s.isPaused);
  const togglePause = useGameStore((s) => s.togglePause);
  const autoPlay = useGameStore((s) => s.autoPlay);
  const toggleAutoPlay = useGameStore((s) => s.toggleAutoPlay);
  const speedOptions = [1, 2, 5, 10, 100];

  return (
    <div className="fixed top-0 left-0 w-full h-[48px] z-50 flex flex-row items-center px-4 gap-2 bg-[#0f0f0f]/95 border-b border-[#2a2a2a] backdrop-blur-sm">
      {/* Game title + tick */}
      <div className="flex flex-col mr-3 border-r border-[#2a2a2a] pr-3">
        <span
          style={{ color: "#e8e8d0", fontSize: "9px", letterSpacing: "0.1em" }}
        >
          HOLDFAST
        </span>
        <span style={{ color: "#555550", fontSize: "7px" }}>
          TICK {tickCount}
        </span>
        <div className="flex flex-wrap gap-1 mt-1">
          <button
            className={`px-2 py-[1px] border transition-all ${
              isPaused
                ? "border-[#4aaf4a] bg-[#1a1a1a] hover:border-[#6fd16f]"
                : "border-[#c04040] bg-[#1a1a1a] hover:border-[#e07070]"
            }`}
            style={{ fontSize: "6px", color: "#e8e8d0" }}
            onClick={togglePause}
          >
            {isPaused ? "RESUME" : "PAUSE"}
          </button>
          {speedOptions.map((speed) => (
            <button
              key={speed}
              className={`px-1 py-[1px] border transition-all ${
                simSpeed === speed
                  ? "border-[#e8e8d0] bg-[#1a1a1a]"
                  : "border-[#2a2a2a] hover:border-[#888870]"
              }`}
              style={{ fontSize: "6px", color: "#e8e8d0" }}
              onClick={() => setSimSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
          <button
            className={`px-2 py-[1px] border transition-all ml-1 ${
              autoPlay
                ? "border-[#6a60c0] bg-[#1a1a1a] hover:border-[#8b84d7]"
                : "border-[#2a2a2a] bg-[#1a1a1a] hover:border-[#888870]"
            }`}
            style={{ fontSize: "6px", color: autoPlay ? "#8b84d7" : "#e8e8d0" }}
            onClick={toggleAutoPlay}
          >
            AUTO: {autoPlay ? "ON" : "OFF"}
          </button>
        </div>
      </div>

      {/* Resources */}
      <div className="flex flex-row items-center gap-4 flex-1">
        <ResourceItem
          color="#c8a020"
          value={resources.food}
          delta={resourceDelta.food}
          label="FOOD"
          icon={<Icons.Food />}
        />
        <ResourceItem
          color="#4a8f3f"
          value={resources.wood}
          delta={resourceDelta.wood}
          label="WOOD"
          icon={<Icons.Wood />}
        />
        <ResourceItem
          color="#909090"
          value={resources.stone}
          delta={resourceDelta.stone}
          label="STONE"
          icon={<Icons.Stone />}
        />
        <ResourceItem
          color="#6a60c0"
          value={resources.knowledge}
          delta={resourceDelta.knowledge}
          label="KNOWLEDGE"
          icon={<Icons.Knowledge />}
        />
      </div>

      {/* Save status */}
      <SaveStatusIndicator status={saveStatus} lastSavedAt={savedAt} />
    </div>
  );
}
