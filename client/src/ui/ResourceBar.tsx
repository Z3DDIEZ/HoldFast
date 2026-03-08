import { useGameStore } from "../state/game-store";
import { SaveStatusIndicator } from "./SaveStatusIndicator";

const ResourceItem = ({
  color,
  value,
  label,
}: {
  color: string;
  value: number;
  label: string;
}) => (
  <div className="flex items-center gap-2">
    <div className="w-2 h-2" style={{ backgroundColor: color }} />
    <div className="flex flex-col">
      <span style={{ color, fontSize: "10px" }}>{value}</span>
      <span style={{ color: "#888870", fontSize: "8px" }}>{label}</span>
    </div>
  </div>
);

export function ResourceBar() {
  const resources = useGameStore((s) => s.resources);
  const saveStatus = useGameStore((s) => s.saveStatus);
  const lastSavedAt = useGameStore((s) => s.lastSavedAt);

  return (
    <div className="fixed top-0 left-0 w-full h-[48px] z-50 flex flex-row items-center px-4 gap-6 bg-[#0f0f0f] border-b border-[#2a2a2a]">
      <div className="flex flex-row items-center gap-6 flex-1">
        <ResourceItem color="#c8a020" value={resources.food} label="FOOD" />
        <ResourceItem color="#4a8f3f" value={resources.wood} label="WOOD" />
        <ResourceItem color="#909090" value={resources.stone} label="STONE" />
        <ResourceItem
          color="#6a60c0"
          value={resources.knowledge}
          label="KNOWLEDGE"
        />
      </div>
      <SaveStatusIndicator status={saveStatus} lastSavedAt={lastSavedAt} />
    </div>
  );
}
