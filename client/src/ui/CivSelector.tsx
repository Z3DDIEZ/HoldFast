
import { useGameStore } from "../state/game-store";
import { CIVILIZATION_LIST } from "../engine/civilizations";
import type { CivilizationId } from "../engine/tick-types";

export function CivSelector({ onClose }: { onClose: () => void }) {
  const currentCivId = useGameStore((s) => s.civilizationId);
  const initEngine = useGameStore((s) => s.initEngine);
  const mapSeed = useGameStore((s) => s.mapSeed);

  const handleSelect = (id: CivilizationId) => {
    initEngine(mapSeed, id, true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="w-[500px] bg-[#0f0f0f] border border-[#ffffff10] rounded-2xl p-8 shadow-2xl flex flex-col gap-6">
        <div className="flex justify-between items-center border-b border-[#ffffff10] pb-4">
          <h2 className="text-xl font-bold tracking-tighter text-[#e8e8d0]">SELECT CIVILIZATION</h2>
          <button 
            onClick={onClose}
            className="text-[#888870] hover:text-[#e8e8d0] transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          {CIVILIZATION_LIST.map((civ) => (
            <button
              key={civ.id}
              onClick={() => handleSelect(civ.id)}
              className={`group flex flex-col gap-2 p-4 border rounded-xl transition-all text-left ${
                currentCivId === civ.id
                  ? "border-current bg-current/10"
                  : "border-[#ffffff08] bg-[#ffffff03] hover:border-[#ffffff20] hover:bg-[#ffffff08]"
              }`}
              style={{ color: civ.color }}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg tracking-tight">{civ.name}</span>
                {currentCivId === civ.id && (
                  <span className="text-[10px] bg-current/20 px-2 py-1 rounded uppercase tracking-widest font-bold">ACTIVE</span>
                )}
              </div>
              <p className="text-[#888870] text-xs leading-relaxed group-hover:text-[#a0a090] transition-colors">
                {civ.description}
              </p>
              
              <div className="flex flex-wrap gap-2 mt-1">
                {civ.bonuses.constructionSpeedMultiplier && (
                   <span className="text-[9px] bg-[#4aaf4a15] text-[#4aaf4a] px-2 py-1 rounded border border-[#4aaf4a20]">
                     +{Math.round((civ.bonuses.constructionSpeedMultiplier - 1) * 100)}% Construction Speed
                   </span>
                )}
                {civ.bonuses.yieldMultiplier?.knowledge && (
                   <span className="text-[9px] bg-[#6a60c015] text-[#8b84d7] px-2 py-1 rounded border border-[#6a60c020]">
                     +{Math.round((civ.bonuses.yieldMultiplier.knowledge - 1) * 100)}% Knowledge Yield
                   </span>
                )}
                {civ.bonuses.yieldMultiplier?.stone && (
                   <span className="text-[9px] bg-[#90909015] text-[#b0b0b0] px-2 py-1 rounded border border-[#90909020]">
                     +{Math.round((civ.bonuses.yieldMultiplier.stone - 1) * 100)}% Stone Yield
                   </span>
                )}
                {civ.bonuses.visionRadiusBoost && (
                   <span className="text-[9px] bg-[#eab30815] text-[#eab308] px-2 py-1 rounded border border-[#eab30820]">
                     +{civ.bonuses.visionRadiusBoost} Range vision
                   </span>
                )}
                {civ.bonuses.costMultiplier?.wood && (
                   <span className="text-[9px] bg-[#4a8f3f15] text-[#63ad57] px-2 py-1 rounded border border-[#4a8f3f20]">
                     -{Math.round((1 - civ.bonuses.costMultiplier.wood) * 100)}% Wood Cost
                   </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
