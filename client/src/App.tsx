import { useEffect, useRef, useState } from "react";
import { ResourceBar } from "./ui/ResourceBar";
import { EraPanel } from "./ui/EraPanel";
import { BuildingPalette } from "./ui/BuildingPalette";
import { Minimap } from "./ui/Minimap";
import { useGameStore } from "./state/game-store";
import { CanvasRenderer } from "./renderer/canvas-renderer";
import { tileIdToCoord } from "./engine/pathfinder";

/** Tile type display names for the tooltip. */
const TILE_NAMES: Record<string, string> = {
  GRASSLAND: "Grassland",
  FOREST: "Forest",
  STONE_DEPOSIT: "Stone Deposit",
  WATER: "Water",
  BARREN: "Barren",
};

/** Building type display names for the tooltip. */
const BUILDING_NAMES: Record<string, string> = {
  TOWN_HALL: "Town Hall",
  FORAGER_HUT: "Forager Hut",
  LUMBER_MILL: "Lumber Mill",
  QUARRY: "Quarry",
  STOREHOUSE: "Storehouse",
  FARM: "Farm",
  LIBRARY: "Library",
  BARRACKS: "Barracks",
};

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);

  const store = useGameStore();
  const {
    placeBuilding,
    initEngine,
    updateCamera,
    setHoveredTile,
    camera,
    tiles,
    buildings,
    workers,
    selectedBuilding,
    hoveredTileId,
  } = store;

  // Tooltip position tracking
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    initEngine("deterministic-seed-123");
  }, [initEngine]);

  useEffect(() => {
    if (canvasRef.current && !rendererRef.current) {
      rendererRef.current = new CanvasRenderer(canvasRef.current);
    }

    return () => {
      rendererRef.current?.cleanup();
    };
  }, []);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.updateState(store, camera);
    }
  }, [store, camera]);

  // Track total drag distance to distinguish click from drag
  const dragDistance = useRef(0);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!rendererRef.current) return;

    // Only treat as click if drag distance was minimal
    if (dragDistance.current > 5) return;

    const tileId = rendererRef.current.screenToTileId(e.clientX, e.clientY);
    if (tileId !== null && selectedBuilding) {
      placeBuilding(tileId);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.min(Math.max(0.2, camera.zoom + delta), 4.0);
    updateCamera({ zoom: newZoom });
  };

  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragDistance.current = 0;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update hovered tile for tooltip and selection highlight
    if (rendererRef.current) {
      const tileId = rendererRef.current.screenToTileId(e.clientX, e.clientY);
      setHoveredTile(tileId);
      setTooltipPos({ x: e.clientX, y: e.clientY });
    }

    if (!isDragging.current) return;

    const dx = e.clientX - lastMousePos.current.x;
    const dy = e.clientY - lastMousePos.current.y;
    dragDistance.current += Math.abs(dx) + Math.abs(dy);

    updateCamera({
      offsetX: camera.offsetX + dx,
      offsetY: camera.offsetY + dy,
    });
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    setHoveredTile(null);
  };

  // Compute tooltip data
  const hoveredTile = hoveredTileId !== null ? tiles[hoveredTileId] : null;
  const hoveredBuilding = hoveredTile?.buildingId
    ? buildings.find((b) => b.id === hoveredTile.buildingId)
    : null;
  const tileWorkers =
    hoveredTileId !== null
      ? workers.filter((w) => {
          const wTileId = w.position.y * 80 + w.position.x;
          return wTileId === hoveredTileId;
        })
      : [];

  const showTooltip =
    hoveredTile &&
    hoveredTile.visible &&
    !isDragging.current &&
    tooltipPos.y > 60 &&
    tooltipPos.y < window.innerHeight - 110;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className={`absolute inset-0 w-full h-full ${selectedBuilding ? "cursor-crosshair" : "cursor-grab"}`}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      <ResourceBar />
      <EraPanel />
      <BuildingPalette />
      <Minimap />

      {/* Tile info tooltip */}
      {showTooltip && hoveredTile && (
        <div
          className="fixed z-50 pointer-events-none bg-[#0f0f0f]/95 border border-[#2a2a2a] px-3 py-2 backdrop-blur-sm"
          style={{
            left: tooltipPos.x + 16,
            top: tooltipPos.y - 8,
            maxWidth: 200,
          }}
        >
          {/* Tile type */}
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: "#e8e8d0", fontSize: "8px" }}>
              {TILE_NAMES[hoveredTile.type] || hoveredTile.type}
            </span>
            {hoveredTile.owned && (
              <span style={{ color: "#4aaf4a", fontSize: "6px" }}>OWNED</span>
            )}
          </div>

          {/* Coordinates */}
          {hoveredTileId !== null && (
            <div className="mb-1">
              <span style={{ color: "#555550", fontSize: "6px" }}>
                ({tileIdToCoord(hoveredTileId).x},{" "}
                {tileIdToCoord(hoveredTileId).y})
              </span>
            </div>
          )}

          {/* Building info */}
          {hoveredBuilding && (
            <div className="border-t border-[#2a2a2a] pt-1 mt-1">
              <span style={{ color: "#c8a020", fontSize: "7px" }}>
                {BUILDING_NAMES[hoveredBuilding.type] || hoveredBuilding.type}
              </span>
              <div className="flex gap-2">
                <span style={{ color: "#888870", fontSize: "6px" }}>
                  {hoveredBuilding.operational ? "OPERATIONAL" : "IDLE"}
                </span>
                <span style={{ color: "#888870", fontSize: "6px" }}>
                  {hoveredBuilding.assignedWorkerIds.length} workers
                </span>
              </div>
            </div>
          )}

          {/* Workers on this tile */}
          {tileWorkers.length > 0 && (
            <div className="border-t border-[#2a2a2a] pt-1 mt-1">
              <span style={{ color: "#888870", fontSize: "6px" }}>
                {tileWorkers.length} worker{tileWorkers.length > 1 ? "s" : ""}{" "}
                here
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
