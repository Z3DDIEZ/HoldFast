import { useEffect, useRef } from "react";
import { ResourceBar } from "./ui/ResourceBar";
import { EraPanel } from "./ui/EraPanel";
import { BuildingPalette } from "./ui/BuildingPalette";
import { useGameStore } from "./state/game-store";
import { CanvasRenderer } from "./renderer/canvas-renderer";

function App() {
  const initEngine = useGameStore((s) => s.initEngine);
  const state = useGameStore((s) => s); // subscribe to all state for the renderer to sync
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  // Initialize engine and renderer
  useEffect(() => {
    // Generate deterministic start
    initEngine("alpha-seed-2026");

    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.cleanup();
      }
    };
  }, [initEngine]);

  // Sync state cleanly
  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateState(state);
    }
  }, [state]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className="absolute inset-0 w-full h-full"
      />

      <ResourceBar />
      <EraPanel />
      <BuildingPalette />

      {/* Minimap placeholder */}
      <div className="fixed bottom-[96px] right-0 w-[160px] h-[160px] border border-[#2a2a2a] bg-[#0f0f0f] z-40 flex items-center justify-center pointer-events-none">
        <span style={{ color: "#888870", fontSize: "8px" }}>MINIMAP</span>
      </div>
    </div>
  );
}

export default App;
