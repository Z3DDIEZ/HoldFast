import { useEffect, useRef, useState } from "react";
import { ResourceBar } from "./ui/ResourceBar";
import { EraPanel } from "./ui/EraPanel";
import { HUD } from "./ui/BuildingPalette";
import { Minimap } from "./ui/Minimap";
import { useGameStore } from "./state/game-store";
import { CanvasRenderer } from "./renderer/canvas-renderer";
import { tileIdToCoord } from "./engine/pathfinder";
import { BUILDING_CONFIG } from "./engine/building-config";
import { CivSelector } from "./ui/CivSelector";
import type { CivilizationId } from "./engine/tick-types";

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
    saveGame,
    loadLatest,
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
    gameStarted,
    playerCivId,
  } = store;

  const [checkingSave, setCheckingSave] = useState(true);

  // Tooltip position tracking
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [confirmDemolishId, setConfirmDemolishId] = useState<string | null>(
    null,
  );

  const mapSeedRef = useRef<string | null>(null);

  const handleCivSelect = (civId: CivilizationId) => {
    const seed =
      mapSeedRef.current ??
      (mapSeedRef.current = `seed-${Math.random().toString(36).substring(2, 9)}`);
    initEngine(seed, civId);
  };

  useEffect(() => {
    let active = true;
    loadLatest()
      .finally(() => {
        if (active) setCheckingSave(false);
      });
    return () => {
      active = false;
    };
  }, [loadLatest]);

  useEffect(() => {
    if (!gameStarted) return;
    saveGame();
    const interval = setInterval(() => {
      saveGame();
    }, 30000);
    return () => clearInterval(interval);
  }, [gameStarted, saveGame]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTileId(null);
        setConfirmDemolishId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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
  const lastHoverTileId = useRef<number | null>(null);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (!rendererRef.current) return;

    // Only treat as click if drag distance was minimal
    if (dragDistance.current > 5) return;

    const tileId = rendererRef.current.screenToTileId(e.clientX, e.clientY);
    if (tileId !== null) {
      if (confirmDemolishId !== null) setConfirmDemolishId(null);
      if (selectedBuilding) {
        placeBuilding(tileId);
      } else {
        if (selectedTileId === tileId) {
          setSelectedTileId(null);
        } else {
          const tile = tiles[tileId];
            if (tile?.buildingId) {
              setSelectedTileId(tileId);
              store.selectPlacedBuilding(tile.buildingId);
            } else {
              setSelectedTileId(null);
              store.selectPlacedBuilding(null);
            }
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.min(Math.max(0.2, camera.zoom + delta), 4.0);
    updateCamera({ zoom: newZoom });
  };

  const isDraggingRef = useRef(false);
  const [dragging, setDragging] = useState(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    setDragging(true);
    dragDistance.current = 0;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update hovered tile for tooltip and selection highlight
    if (rendererRef.current) {
      const tileId = rendererRef.current.screenToTileId(e.clientX, e.clientY);
      setHoveredTile(tileId);
      setTooltipPos({ x: e.clientX, y: e.clientY });
      if (tileId !== lastHoverTileId.current) {
        lastHoverTileId.current = tileId;
        if (selectedTileId === null && confirmDemolishId !== null) {
          setConfirmDemolishId(null);
        }
      }
    }

    if (!isDraggingRef.current) return;

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
    isDraggingRef.current = false;
    setDragging(false);
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    setDragging(false);
    setHoveredTile(null);
    lastHoverTileId.current = null;
    if (selectedTileId === null && confirmDemolishId !== null) {
      setConfirmDemolishId(null);
    }
  };

  // Show ONLY player's buildings in the right panel
  const playerBuildings = buildings.filter(b => b.ownerId === playerCivId);
  const playerWorkers = workers.filter(w => w.ownerId === playerCivId);

  // Priority for right panel: selected tile > hovered tile
  const activeTileId = selectedTileId !== null ? selectedTileId : hoveredTileId;
  const activeTile = activeTileId !== null ? tiles[activeTileId] : null;

  const activeBuilding = activeTile?.buildingId
    ? playerBuildings.find((b) => b.id === activeTile.buildingId)
    : null;
  const activeBuildingConfig = activeBuilding
    ? BUILDING_CONFIG[activeBuilding.type]
    : null;

  // Compute tooltip data for the cursor hover strictly
  const hoveredTile = hoveredTileId !== null ? tiles[hoveredTileId] : null;
  const hoveredBuilding = hoveredTile?.buildingId
    ? buildings.find((b) => b.id === hoveredTile.buildingId)
    : null;
  const hoveredBuildingConfig = hoveredBuilding
    ? BUILDING_CONFIG[hoveredBuilding.type]
    : null;

  const idleWorkers = playerWorkers.filter(
    (w) => w.assignedBuildingId === null && w.state === "IDLE",
  );
  const assignedWorkerIds = activeBuilding?.assignedWorkerIds ?? [];
  const idleWorkersToShow = idleWorkers.slice(0, 6);
  const assignedWorkersToShow = assignedWorkerIds.slice(0, 6);
  const tileWorkers =
    hoveredTileId !== null
      ? workers.filter((w) => {
          const wTileId = w.position.y * 80 + w.position.x;
          return wTileId === hoveredTileId;
        })
      : [];

  const canAssignToBuilding =
    activeBuilding &&
    activeBuildingConfig &&
    activeBuilding.constructionTicksRemaining === 0 &&
    activeBuildingConfig.requiredWorkers > 0 &&
    activeBuildingConfig.resource;
  const availableSlots = canAssignToBuilding
    ? activeBuildingConfig.requiredWorkers - assignedWorkerIds.length
    : 0;
  const canAssignWorker =
    canAssignToBuilding &&
    availableSlots > 0 &&
    idleWorkers.length > 0;
  const canUnassignWorker = assignedWorkerIds.length > 0;
  const canDemolish =
    activeBuilding && activeBuilding.type !== "TOWN_HALL";
  const staffingLabel =
    activeBuilding && activeBuildingConfig
      ? activeBuildingConfig.requiredWorkers > 0
        ? `${assignedWorkerIds.length}/${activeBuildingConfig.requiredWorkers} staffed`
        : "No staffing required"
      : "";
  const buildingStatus = activeBuilding
    ? activeBuilding.constructionTicksRemaining > 0
      ? `CONSTRUCTING (${activeBuilding.constructionTicksRemaining}t)`
      : activeBuilding.operational
        ? "OPERATIONAL"
        : "IDLE"
    : "";

  const showTooltip =
    hoveredTile &&
    hoveredTile.visible &&
    !dragging &&
    tooltipPos.y > 60 &&
    tooltipPos.y < window.innerHeight - 110;

  const tooltipMaxWidth = Math.min(200, window.innerWidth - 16);
  const tooltipLeft = Math.max(
    8,
    Math.min(tooltipPos.x + 16, window.innerWidth - tooltipMaxWidth - 8),
  );

  // ─── Render components ───
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      {!gameStarted && (
        <>
          {checkingSave ? (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
              <span style={{ color: "#e8e8d0", fontSize: "10px" }}>
                Loading save...
              </span>
            </div>
          ) : (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
              <CivSelector onSelect={handleCivSelect} />
            </div>
          )}
        </>
      )}
      <canvas
        ref={canvasRef}
        id="game-canvas"
        className={`absolute inset-0 w-full h-full touch-none ${
          selectedBuilding
            ? "cursor-crosshair"
            : "cursor-grab active:cursor-grabbing"
        }`}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
      />

      <ResourceBar />
      <EraPanel />
      <HUD />
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

      {/* Building actions panel — only for player's buildings */}
      {activeBuilding && activeBuildingConfig && (
        <div className="fixed right-0 top-[56px] w-[220px] z-40 bg-[#0f0f0f]/95 border-l border-b border-[#2a2a2a] backdrop-blur-sm p-3 flex flex-col gap-2 pointer-events-auto">
          {/* Header indicating selection status */}
          {selectedTileId !== null && (
            <div className="absolute -left-[1px] top-0 bottom-0 w-[2px] bg-[#c8a020]"></div>
          )}
          <div className="flex flex-col gap-1 border-b border-[#2a2a2a] pb-2">
            <div className="flex justify-between items-center">
              <span style={{ color: "#888870", fontSize: "7px" }}>
                BUILDING
              </span>
              {selectedTileId !== null && (
                <span style={{ color: "#c8a020", fontSize: "6px" }}>SELECTED</span>
              )}
            </div>
            <span style={{ color: "#e8e8d0", fontSize: "9px" }}>
              {activeBuildingConfig.name}
            </span>
            <span style={{ color: "#555550", fontSize: "7px" }}>
              {staffingLabel}
            </span>
            {activeBuilding.constructionTicksRemaining > 0 && (
              <span style={{ color: "#c8a020", fontSize: "7px" }}>
                {buildingStatus}
              </span>
            )}
          </div>

          <div className="flex justify-between">
            <span style={{ color: "#888870", fontSize: "7px" }}>
              IDLE WORKERS
            </span>
            <span style={{ color: "#e8e8d0", fontSize: "8px" }}>
              {idleWorkers.length}
            </span>
          </div>

          {canAssignToBuilding ? (
            <div className="flex flex-col gap-1">
              <span style={{ color: "#888870", fontSize: "7px" }}>
                ASSIGN ({Math.max(0, availableSlots)} slots)
              </span>
              <div className="flex flex-wrap gap-1">
                {idleWorkersToShow.length === 0 && (
                  <span style={{ color: "#555550", fontSize: "7px" }}>
                    None
                  </span>
                )}
                {idleWorkersToShow.map((worker) => (
                  <button
                    key={worker.id}
                    className={`px-1 py-[1px] border transition-all ${
                      canAssignWorker
                        ? "border-[#4a8f3f] bg-[#4a8f3f]/20 hover:bg-[#4a8f3f]/40 cursor-pointer"
                        : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
                    }`}
                    style={{ fontSize: "6px", color: "#e8e8d0" }}
                    onClick={() => {
                      if (!canAssignWorker || !activeBuilding) return;
                      assignWorker(worker.id, activeBuilding.id);
                    }}
                    disabled={!canAssignWorker}
                  >
                    {worker.id}
                  </button>
                ))}
                {idleWorkers.length > idleWorkersToShow.length && (
                  <span style={{ color: "#555550", fontSize: "6px" }}>
                    +{idleWorkers.length - idleWorkersToShow.length} more
                  </span>
                )}
              </div>
            </div>
          ) : (
            <span style={{ color: "#555550", fontSize: "7px" }}>
              No staffing required
            </span>
          )}

          <div className="flex flex-col gap-1">
            <span style={{ color: "#888870", fontSize: "7px" }}>
              ASSIGNED
            </span>
            <div className="flex flex-wrap gap-1">
              {assignedWorkersToShow.length === 0 && (
                <span style={{ color: "#555550", fontSize: "7px" }}>
                  None
                </span>
              )}
              {assignedWorkersToShow.map((workerId) => (
                <button
                  key={workerId}
                  className={`px-1 py-[1px] border transition-all ${
                    canUnassignWorker
                      ? "border-[#c8a020] bg-[#c8a020]/20 hover:bg-[#c8a020]/40 cursor-pointer"
                      : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
                  }`}
                  style={{ fontSize: "6px", color: "#e8e8d0" }}
                  onClick={() => {
                    if (!canUnassignWorker) return;
                    unassignWorker(workerId);
                  }}
                  disabled={!canUnassignWorker}
                >
                  {workerId}
                </button>
              ))}
              {assignedWorkerIds.length > assignedWorkersToShow.length && (
                <span style={{ color: "#555550", fontSize: "6px" }}>
                  +{assignedWorkerIds.length - assignedWorkersToShow.length} more
                </span>
              )}
            </div>
            <button
              className={`py-1 border text-center transition-all ${
                canUnassignWorker
                  ? "border-[#888870] bg-[#888870]/10 hover:bg-[#888870]/30 cursor-pointer"
                  : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
              }`}
              style={{ fontSize: "7px", color: "#e8e8d0" }}
              onClick={() => {
                if (!canUnassignWorker || !activeBuilding) return;
                assignedWorkerIds.forEach((id) => {
                  unassignWorker(id);
                });
              }}
              disabled={!canUnassignWorker}
            >
              UNASSIGN ALL
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <span style={{ color: "#888870", fontSize: "7px" }}>
              DEMOLISH
            </span>
            {confirmDemolishId === activeBuilding.id ? (
              <div className="grid grid-cols-2 gap-1">
                <button
                  className="py-1 border border-[#c04040] bg-[#c04040]/20 hover:bg-[#c04040]/40 text-center"
                  style={{ fontSize: "7px", color: "#e8e8d0" }}
                  onClick={() => {
                    if (!canDemolish || !activeBuilding) return;
                    demolishBuilding(activeBuilding.id);
                    if (selectedTileId === activeTileId) {
                      setSelectedTileId(null);
                    }
                    setConfirmDemolishId(null);
                  }}
                >
                  CONFIRM
                </button>
                <button
                  className="py-1 border border-[#2a2a2a] bg-transparent hover:bg-[#1a1a1a] text-center"
                  style={{ fontSize: "7px", color: "#e8e8d0" }}
                  onClick={() => setConfirmDemolishId(null)}
                >
                  CANCEL
                </button>
              </div>
            ) : (
              <button
                className={`py-1 border text-center transition-all ${
                  canDemolish
                    ? "border-[#c04040] bg-[#c04040]/20 hover:bg-[#c04040]/40 cursor-pointer"
                    : "border-[#2a2a2a] bg-transparent opacity-40 cursor-not-allowed"
                }`}
                style={{ fontSize: "7px", color: "#e8e8d0" }}
                onClick={() => {
                  if (!canDemolish || !activeBuilding) return;
                  setConfirmDemolishId(activeBuilding.id);
                }}
                disabled={!canDemolish}
              >
                DEMOLISH
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tile info tooltip */}
      {showTooltip && hoveredTile && (
        <div
          className="fixed z-50 pointer-events-none bg-[#0f0f0f]/95 border border-[#2a2a2a] px-3 py-2 backdrop-blur-sm"
          style={{
            left: tooltipLeft,
            top: tooltipPos.y - 8,
            maxWidth: tooltipMaxWidth,
          }}
        >
          {/* Tile type */}
          <div className="flex items-center gap-2 mb-1">
            <span style={{ color: "#e8e8d0", fontSize: "8px" }}>
              {TILE_NAMES[hoveredTile.type] || hoveredTile.type}
            </span>
            {hoveredTile.owned && (
              <span style={{ 
                color: hoveredTile.ownerId === playerCivId ? "#4aaf4a" : "#c04040", 
                fontSize: "6px" 
              }}>
                {hoveredTile.ownerId === playerCivId ? "YOURS" : "ENEMY"}
              </span>
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
                  {hoveredBuilding.constructionTicksRemaining > 0 
                    ? `CONSTRUCTING (${hoveredBuilding.constructionTicksRemaining}t)` 
                    : hoveredBuilding.operational ? "OPERATIONAL" : "IDLE"}
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
