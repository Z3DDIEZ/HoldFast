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

    // Only place if not panning (dragging)
    // Check if total drag distance was small
    const tileId = rendererRef.current.screenToTileId(e.clientX, e.clientY);
    if (tileId !== null && state.selectedBuilding) {
      placeBuilding(tileId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!rendererRef.current) return;
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    rendererRef.current.setZoom(delta);
  };

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !rendererRef.current) return;
    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    rendererRef.current.pan(dx, dy);
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className="absolute inset-0 w-full h-full cursor-crosshair"
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />

      <ResourceBar />
      <EraPanel />
      <BuildingPalette />
      <Minimap />
    </div>
  );
}

export default App;
