import { CIVILIZATION_LIST } from "../engine/civilizations";
import type { CivilizationId } from "../engine/tick-types";

function BonusPill({ text, color, bg }: { text: string; color: string; bg: string }) {
  return (
    <span
      className="text-[9px] px-2 py-1 rounded border"
      style={{ color, backgroundColor: bg, borderColor: `${bg.slice(0, 7)}20` }}
    >
      {text}
    </span>
  );
}

/**
 * Civilization selection overlay — shown at startup.
 * Cannot be dismissed without selecting a civ. Selecting starts the game.
 */
export function CivSelector({ onSelect }: { onSelect: (id: CivilizationId) => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="w-[520px] max-w-[92vw] max-h-[85vh] overflow-hidden bg-[#0f0f0f] border border-[#ffffff10] rounded-2xl p-8 shadow-2xl flex flex-col gap-6">
        <div className="border-b border-[#ffffff10] pb-4">
          <h2 className="text-xl font-bold tracking-tighter text-[#e8e8d0]">CHOOSE YOUR CIVILIZATION</h2>
          <p className="text-[10px] text-[#888870] mt-1">Each civilization brings unique bonuses. Choose wisely — this cannot be changed.</p>
        </div>

        <div className="grid grid-cols-1 gap-3 max-h-[min(400px,55vh)] overflow-y-auto pr-2 custom-scrollbar">
          {CIVILIZATION_LIST.map((civ) => (
            <button
              key={civ.id}
              onClick={() => onSelect(civ.id)}
              className="group flex flex-col gap-2 p-4 border rounded-xl transition-all text-left border-[#ffffff08] bg-[#ffffff03] hover:border-[#ffffff20] hover:bg-[#ffffff08]"
              style={{ color: civ.color }}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-lg tracking-tight">{civ.name}</span>
              </div>
              <p className="text-[#888870] text-xs leading-relaxed group-hover:text-[#a0a090] transition-colors">
                {civ.description}
              </p>
              
              <div className="flex flex-wrap gap-2 mt-1">
                {civ.bonuses.constructionSpeedMultiplier && (
                   <BonusPill bg="#4aaf4a15" color="#4aaf4a" text={`+${Math.round((civ.bonuses.constructionSpeedMultiplier - 1) * 100)}% Construction Speed`} />
                )}
                {civ.bonuses.yieldMultiplier?.knowledge && (
                   <BonusPill bg="#6a60c015" color="#8b84d7" text={`+${Math.round((civ.bonuses.yieldMultiplier.knowledge - 1) * 100)}% Knowledge Yield`} />
                )}
                {civ.bonuses.yieldMultiplier?.stone && (
                   <BonusPill bg="#90909015" color="#b0b0b0" text={`+${Math.round((civ.bonuses.yieldMultiplier.stone - 1) * 100)}% Stone Yield`} />
                )}
                {civ.bonuses.visionRadiusBoost && (
                   <BonusPill bg="#eab30815" color="#eab308" text={`+${civ.bonuses.visionRadiusBoost} Range vision`} />
                )}
                {civ.bonuses.costMultiplier?.wood && (
                   <BonusPill bg="#4a8f3f15" color="#63ad57" text={`-${Math.round((1 - civ.bonuses.costMultiplier.wood) * 100)}% Wood Cost`} />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
