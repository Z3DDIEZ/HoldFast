import { useGameStore } from "../state/game-store";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

const ResourceItem = ({
  color,
  value,
  label,
  icon,
}: {
  color: string;
  value: number;
  label: string;
  icon: React.ReactNode;
}) => (
  <div className="flex items-center gap-2">
    <div className="w-4 h-4 flex items-center justify-center" style={{ color }}>
      {icon}
    </div>
    <div className="flex flex-col">
      <span style={{ color, fontSize: "10px" }}>{value}</span>
      <span style={{ color: "#888870", fontSize: "8px" }}>{label}</span>
    </div>
  </div>
);

const Icons = {
  Food: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
  Wood: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="2" width="16" height="20" rx="2" />
    </svg>
  ),
  Stone: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L2 22h20L12 2z" />
    </svg>
  ),
  Knowledge: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L1 21h22L12 2zm0 4l7.5 13h-15L12 6z" />
    </svg>
  ),
};

export function ResourceBar() {
  const resources = useGameStore((s) => s.resources);
  const saveStatus = useGameStore((s) => s.saveStatus);
  const savedAt = useGameStore((s) => s.savedAt);

  return (
    <div className="fixed top-0 left-0 w-full h-[48px] z-50 flex flex-row items-center px-4 gap-6 bg-[#0f0f0f] border-b border-[#2a2a2a]">
      <div className="flex flex-row items-center gap-6 flex-1">
        <ResourceItem
          color="#c8a020"
          value={resources.food}
          label="FOOD"
          icon={<Icons.Food />}
        />
        <ResourceItem
          color="#4a8f3f"
          value={resources.wood}
          label="WOOD"
          icon={<Icons.Wood />}
        />
        <ResourceItem
          color="#909090"
          value={resources.stone}
          label="STONE"
          icon={<Icons.Stone />}
        />
        <ResourceItem
          color="#6a60c0"
          value={resources.knowledge}
          label="KNOWLEDGE"
          icon={<Icons.Knowledge />}
        />
      </div>
      <SaveStatusIndicator status={saveStatus} lastSavedAt={savedAt} />
    </div>
  );
}
