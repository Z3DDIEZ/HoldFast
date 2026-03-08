import { useEffect, useRef } from "react";
import { ResourceBar } from "./ui/ResourceBar";
import { EraPanel } from "./ui/EraPanel";
import { BuildingPalette } from "./ui/BuildingPalette";
import { Minimap } from "./ui/Minimap";
import { useGameStore } from "./state/game-store";
import { CanvasRenderer } from "./renderer/canvas-renderer";

function App() {
  const initEngine = useGameStore((s) => s.initEngine);
  const state = useGameStore((s) => s);
  const placeBuilding = useGameStore((s) => s.placeBuilding);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  useEffect(() => {
    initEngine("alpha-seed-2026");

    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }

    return () => {
      rendererRef.current?.cleanup();
    };
  }, [initEngine]);

  useEffect(() => {
    rendererRef.current?.updateState(state);
  }, [state]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!rendererRef.current) return;

    const tileCoords = rendererRef.current.screenToTile(e.clientX, e.clientY);
    if (tileCoords && state.selectedBuilding) {
      placeBuilding(tileCoords.x, tileCoords.y);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
      />

      <ResourceBar />
      <EraPanel />
      <BuildingPalette />
      <Minimap />
    </div>
  );
}

export default App;
