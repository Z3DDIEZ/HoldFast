import { useEffect, useRef, useState } from "react";
import { ResourceBar } from "./ui/ResourceBar";
import { EraPanel } from "./ui/EraPanel";
import { BuildingPalette } from "./ui/BuildingPalette";
import { Minimap } from "./ui/Minimap";
import { useGameStore } from "./state/game-store";
import { CanvasRenderer } from "./renderer/canvas-renderer";
import { tileIdToCoord } from "./engine/pathfinder";
import { BUILDING_CONFIG } from "./engine/building-config";

/** Tile type display names for the tooltip. */
const TILE_NAMES: Record<string, string> = {
  GRASSLAND: "Grassland",
  FOREST: "Forest",
  STONE_DEPOSIT: "Stone Deposit",
  WATER: "Water",
  BARREN: "Barren",
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
    assignWorker,
    unassignWorker,
    demolishBuilding,
    actionAlerts,
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
  const hoveredBuildingConfig = hoveredBuilding
    ? BUILDING_CONFIG[hoveredBuilding.type]
    : null;
  const idleWorkers = workers.filter(
    (w) => w.assignedBuildingId === null && w.state === "IDLE",
  );
  const tileWorkers =
    hoveredTileId !== null
      ? workers.filter((w) => {
          const wTileId = w.position.y * 80 + w.position.x;
          return wTileId === hoveredTileId;
        })
      : [];

  const canAssignWorker =
    hoveredBuilding &&
    hoveredBuildingConfig &&
    hoveredBuildingConfig.requiredWorkers > 0 &&
    hoveredBuildingConfig.resource &&
    hoveredBuilding.assignedWorkerIds.length <
      hoveredBuildingConfig.requiredWorkers &&
    idleWorkers.length > 0;
  const canUnassignWorker =
    hoveredBuilding && hoveredBuilding.assignedWorkerIds.length > 0;
  const canDemolish =
    hoveredBuilding && hoveredBuilding.type !== "TOWN_HALL";
  const staffingLabel =
    hoveredBuilding && hoveredBuildingConfig
      ? hoveredBuildingConfig.requiredWorkers > 0
        ? `${hoveredBuilding.assignedWorkerIds.length}/${hoveredBuildingConfig.requiredWorkers} staffed`
        : "No staffing required"
      : "";

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

      {/* Action rejection alerts */}
      {actionAlerts.length > 0 && (
        <div className="fixed top-[52px] right-3 z-50 flex flex-col gap-1 pointer-events-none">
          {actionAlerts.map((alert) => (
            <div
              key={alert.id}
              className="px-2 py-1 bg-[#0f0f0f]/95 border border-[#2a2a2a]"
              style={{ color: "#e8e8d0", fontSize: "7px" }}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}

      {/* Building actions panel */}
      {hoveredBuilding && hoveredBuildingConfig && (
        <div className="fixed right-0 top-[56px] w-[220px] z-40 bg-[#0f0f0f]/95 border-l border-b border-[#2a2a2a] backdrop-blur-sm p-3 flex flex-col gap-2 pointer-events-auto">
          <div className="flex flex-col gap-1 border-b border-[#2a2a2a] pb-2">
            <span style={{ color: "#888870", fontSize: "7px" }}>
              BUILDING
            </span>
            <span style={{ color: "#e8e8d0", fontSize: "9px" }}>
              {hoveredBuildingConfig.name}
            </span>
            <span style={{ color: "#555550", fontSize: "7px" }}>
              {staffingLabel}
            </span>
          </div>

          <div className="flex justify-between">
            <span style={{ color: "#888870", fontSize: "7px" }}>
              IDLE WORKERS
            </span>
            <span style={{ color: "#e8e8d0", fontSize: "8px" }}>
              {idleWorkers.length}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <button
              className={`py-1 border text-center transition-all ${
                canAssignWorker
                  ? "border-[#4a8f3f] bg-[#4a8f3f]/20 hover:bg-[#4a8f3f]/40 cursor-pointer"
                  : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
              }`}
              style={{ fontSize: "7px", color: "#e8e8d0" }}
              onClick={() => {
                if (!canAssignWorker || !hoveredBuilding) return;
                const worker = idleWorkers[0];
                if (worker) assignWorker(worker.id, hoveredBuilding.id);
              }}
              disabled={!canAssignWorker}
            >
              ASSIGN IDLE
            </button>
            <button
              className={`py-1 border text-center transition-all ${
                canUnassignWorker
                  ? "border-[#c8a020] bg-[#c8a020]/20 hover:bg-[#c8a020]/40 cursor-pointer"
                  : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
              }`}
              style={{ fontSize: "7px", color: "#e8e8d0" }}
              onClick={() => {
                if (!canUnassignWorker || !hoveredBuilding) return;
                const targetId = hoveredBuilding.assignedWorkerIds[0];
                if (targetId) unassignWorker(targetId);
              }}
              disabled={!canUnassignWorker}
            >
              UNASSIGN 1
            </button>
            <button
              className={`py-1 border text-center transition-all col-span-2 ${
                canUnassignWorker
                  ? "border-[#888870] bg-[#888870]/10 hover:bg-[#888870]/30 cursor-pointer"
                  : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
              }`}
              style={{ fontSize: "7px", color: "#e8e8d0" }}
              onClick={() => {
                if (!canUnassignWorker || !hoveredBuilding) return;
                hoveredBuilding.assignedWorkerIds.forEach((id) => {
                  unassignWorker(id);
                });
              }}
              disabled={!canUnassignWorker}
            >
              UNASSIGN ALL
            </button>
            <button
              className={`py-1 border text-center transition-all col-span-2 ${
                canDemolish
                  ? "border-[#c04040] bg-[#c04040]/20 hover:bg-[#c04040]/40 cursor-pointer"
                  : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
              }`}
              style={{ fontSize: "7px", color: "#e8e8d0" }}
              onClick={() => {
                if (!canDemolish || !hoveredBuilding) return;
                demolishBuilding(hoveredBuilding.id);
              }}
              disabled={!canDemolish}
            >
              DEMOLISH
            </button>
          </div>
        </div>
      )}

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
                {hoveredBuildingConfig?.name || hoveredBuilding.type}
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
