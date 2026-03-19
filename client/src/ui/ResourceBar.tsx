import { useGameStore } from "../state/game-store";
import { SaveStatusIndicator } from "./SaveStatusIndicator";
import { getCivilization } from "../engine/civilizations";
import React from "react";

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
      {isPositive ? `+${Math.round(value)}` : `${Math.round(value)}`}
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
            {Math.round(value)}
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
 * tick counter, civilization info, and save status.
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
  const playerCivId = useGameStore((s) => s.playerCivId);
  const reRollMap = useGameStore((s) => s.reRollMap);
  const workers = useGameStore((s) => s.workers);

  const civ = getCivilization(playerCivId);
  const speedOptions = [1, 2, 5, 10, 100, 1000];
  const playerWorkerCount = workers.filter(w => w.ownerId === playerCivId).length;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 w-[98%] max-w-[1400px] h-[52px] z-50 flex flex-row items-center px-4 gap-6 bg-[#0f0f0f]/80 border border-[#ffffff10] backdrop-blur-[12px] rounded-xl shadow-2xl">
      {/* Game title + tick */}
      <div className="flex flex-col border-r border-[#ffffff10] pr-6">
        <div className="flex items-center gap-2">
          <span
            className="font-bold tracking-widest"
            style={{ fontSize: "11px", color: civ.color }}
          >
            HOLDFAST
          </span>
          <span
            className="px-1 py-[1px] rounded border text-[7px] font-bold tracking-wide"
            style={{ color: civ.color, borderColor: `${civ.color}40`, backgroundColor: `${civ.color}10` }}
          >
            {civ.name.toUpperCase()}
          </span>
        </div>
        
        <div className="flex items-center gap-3 mt-1">
          <div className="flex items-center gap-1 bg-[#ffffff05] px-2 py-[2px] rounded border border-[#ffffff08]">
            <span style={{ color: "#888870", fontSize: "7px" }}>TICK</span>
            <span style={{ color: "#e8e8d0", fontSize: "7px", fontWeight: "bold" }}>{tickCount}</span>
          </div>

          <div className="flex items-center gap-1 bg-[#ffffff05] px-2 py-[2px] rounded border border-[#ffffff08]">
            <span style={{ color: "#888870", fontSize: "7px" }}>POP</span>
            <span style={{ color: "#e8e8d0", fontSize: "7px", fontWeight: "bold" }}>{playerWorkerCount}</span>
          </div>

          <button
            className="px-2 py-[2px] bg-[#ffffff08] hover:bg-[#ffffff15] border border-[#ffffff10] rounded transition-all text-[#e8e8d0] font-medium"
            style={{ fontSize: "7px" }}
            onClick={() => reRollMap()}
          >
            RE-ROLL SEED
          </button>
        </div>
      </div>

      {/* Simulation Controls */}
      <div className="flex items-center gap-2 border-r border-[#ffffff10] pr-6">
        <button
          className={`flex items-center justify-center w-16 py-1 rounded border transition-all ${
            isPaused
              ? "border-[#4aaf4ab0] bg-[#4aaf4a10] text-[#4aaf4a] hover:bg-[#4aaf4a20]"
              : "border-[#c04040b0] bg-[#c0404010] text-[#c04040] hover:bg-[#c0404020]"
          }`}
          style={{ fontSize: "8px", fontWeight: "600" }}
          onClick={togglePause}
        >
          {isPaused ? "RESUME" : "PAUSE"}
        </button>
        
        <div className="flex gap-1">
          {speedOptions.map((speed) => (
            <button
              key={speed}
              className={`px-2 py-1 rounded border transition-all ${
                simSpeed === speed
                  ? "border-[#e8e8d0] bg-[#ffffff10] text-[#e8e8d0]"
                  : "border-transparent bg-transparent text-[#888870] hover:text-[#e8e8d0] hover:bg-[#ffffff05]"
              }`}
              style={{ fontSize: "8px", fontWeight: "600" }}
              onClick={() => setSimSpeed(speed)}
            >
              {speed}x
            </button>
          ))}
        </div>

        <button
          className={`px-2 py-1 border rounded transition-all ml-1 ${
            autoPlay
              ? "border-[#6a60c0b0] bg-[#6a60c015] text-[#8b84d7] hover:bg-[#6a60c025]"
              : "border-[#ffffff10] bg-transparent text-[#888870] hover:text-[#e8e8d0] hover:bg-[#ffffff05]"
          }`}
          style={{ fontSize: "8px", fontWeight: "600" }}
          onClick={toggleAutoPlay}
        >
          AUTO: {autoPlay ? "ON" : "OFF"}
        </button>
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
