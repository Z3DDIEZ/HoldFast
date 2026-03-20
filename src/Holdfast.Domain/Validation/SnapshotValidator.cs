namespace Holdfast.Domain.Validation;

using Holdfast.Domain.Snapshots;

public sealed class SnapshotValidator
{
    private static readonly HashSet<string> ValidTileTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "GRASSLAND",
        "FOREST",
        "STONE_DEPOSIT",
        "WATER",
        "BARREN",
    };

    private static readonly HashSet<string> ValidUnitTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "WORKER",
        "SCOUT",
    };

    private static readonly HashSet<string> ValidWorkerStates = new(StringComparer.OrdinalIgnoreCase)
    {
        "IDLE",
        "MOVING_TO_CONSTRUCT",
        "CONSTRUCTING",
        "MOVING_TO_HARVEST",
        "HARVESTING",
        "MOVING_TO_DEPOSIT",
        "DEPOSITING",
        "WAITING",
        "STARVING",
        "SCOUTING",
    };

    public SnapshotValidationResult Validate(GameState snapshot, GameState? lastSnapshot)
    {
        if (snapshot is null)
        {
            throw new ArgumentNullException(nameof(snapshot));
        }

        var violations = new List<SnapshotViolation>();

        var activeCivs = NormalizeActiveCivs(snapshot, violations);
        var civStates = NormalizeCivStates(snapshot, activeCivs, violations);
        ValidateRosterConsistency(snapshot, lastSnapshot, activeCivs, civStates, violations);

        ValidateTickSanity(snapshot, lastSnapshot, violations);
        ValidateMapSeedConsistency(snapshot, lastSnapshot, violations);

        var tiles = snapshot.Tiles ?? Array.Empty<TileState>();
        var buildings = snapshot.Buildings ?? Array.Empty<BuildingState>();
        var workers = snapshot.Workers ?? Array.Empty<WorkerState>();

        var tileIndex = BuildTileIndex(tiles, activeCivs, violations);
        var buildingIndex = BuildBuildingIndex(buildings, activeCivs, tileIndex, violations);
        var workerIndex = BuildWorkerIndex(workers, activeCivs, buildingIndex, violations);

        ValidateTileBuildingLinks(tileIndex, buildingIndex, violations);
        ValidateTownHalls(activeCivs, civStates, buildingIndex, violations);
        ValidateAssignments(buildingIndex, workerIndex, violations);
        ValidateEraGate(activeCivs, civStates, buildingIndex, violations);
        ValidateWorkerCap(activeCivs, buildingIndex, workerIndex, violations);
        ValidateResourceCap(activeCivs, civStates, buildingIndex, workerIndex, snapshot.TickCount, violations);

        return new SnapshotValidationResult(violations);
    }

    private static HashSet<string> NormalizeActiveCivs(GameState snapshot, List<SnapshotViolation> violations)
    {
        var activeCivs = snapshot.ActiveCivs ?? Array.Empty<string>();
        if (activeCivs.Count == 0)
        {
            violations.Add(new SnapshotViolation(
                "CivRoster",
                "activeCivs must contain at least one civilization."));
        }

        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var civId in activeCivs)
        {
            if (string.IsNullOrWhiteSpace(civId))
            {
                violations.Add(new SnapshotViolation(
                    "CivRoster",
                    "activeCivs contains a blank civilization id."));
                continue;
            }

            if (!set.Add(civId))
            {
                violations.Add(new SnapshotViolation(
                    "CivRoster",
                    $"activeCivs contains duplicate id '{civId}'."));
            }
        }

        if (string.IsNullOrWhiteSpace(snapshot.PlayerCivId))
        {
            violations.Add(new SnapshotViolation(
                "CivRoster",
                "playerCivId is required."));
        }
        else if (set.Count > 0 && !set.Contains(snapshot.PlayerCivId))
        {
            violations.Add(new SnapshotViolation(
                "CivRoster",
                $"playerCivId '{snapshot.PlayerCivId}' is not listed in activeCivs."));
        }

        return set;
    }

    private static Dictionary<string, CivRuntimeState> NormalizeCivStates(
        GameState snapshot,
        HashSet<string> activeCivs,
        List<SnapshotViolation> violations)
    {
        var civStates = new Dictionary<string, CivRuntimeState>(StringComparer.OrdinalIgnoreCase);
        if (snapshot.CivStates is not null)
        {
            foreach (var entry in snapshot.CivStates)
            {
                if (!civStates.TryAdd(entry.Key, entry.Value))
                {
                    violations.Add(new SnapshotViolation(
                        "CivRoster",
                        $"civStates contains duplicate entry '{entry.Key}'."));
                }
            }
        }

        if (civStates.Count == 0)
        {
            violations.Add(new SnapshotViolation(
                "CivRoster",
                "civStates must contain entries for active civilizations."));
        }

        foreach (var civId in activeCivs)
        {
            if (!civStates.TryGetValue(civId, out var civState))
            {
                violations.Add(new SnapshotViolation(
                    "CivRoster",
                    $"civStates missing entry for '{civId}'."));
                continue;
            }

            if (!string.Equals(civState.CivilizationId, civId, StringComparison.OrdinalIgnoreCase))
            {
                violations.Add(new SnapshotViolation(
                    "CivRoster",
                    $"civStates entry '{civId}' has mismatched civilizationId '{civState.CivilizationId}'."));
            }

            if (civState.Resources is null)
            {
                violations.Add(new SnapshotViolation(
                    "CivRoster",
                    $"civStates entry '{civId}' has null resources."));
            }

            if (civState.Era < 1 || civState.Era > 4)
            {
                violations.Add(new SnapshotViolation(
                    "EraGate",
                    $"civStates entry '{civId}' has invalid era {civState.Era}."));
            }

            if (civState.TownHallTileId is int townHallId &&
                (townHallId < 0 || townHallId >= SnapshotRules.ExpectedTileCount))
            {
                violations.Add(new SnapshotViolation(
                    "TownHall",
                    $"civStates entry '{civId}' has townHallTileId {townHallId} outside map bounds."));
            }
        }

        foreach (var entry in civStates)
        {
            if (string.IsNullOrWhiteSpace(entry.Key))
            {
                violations.Add(new SnapshotViolation(
                    "CivRoster",
                    "civStates contains a blank civilization id key."));
                continue;
            }

            if (activeCivs.Count > 0 && !activeCivs.Contains(entry.Key))
            {
                violations.Add(new SnapshotViolation(
                    "CivRoster",
                    $"civStates entry '{entry.Key}' is not listed in activeCivs."));
            }
        }

        return civStates;
    }

    private static void ValidateRosterConsistency(
        GameState snapshot,
        GameState? lastSnapshot,
        HashSet<string> activeCivs,
        Dictionary<string, CivRuntimeState> civStates,
        List<SnapshotViolation> violations)
    {
        if (lastSnapshot is null)
        {
            return;
        }

        if (!string.Equals(snapshot.PlayerCivId, lastSnapshot.PlayerCivId, StringComparison.OrdinalIgnoreCase))
        {
            violations.Add(new SnapshotViolation(
                "CivRoster",
                $"playerCivId changed from '{lastSnapshot.PlayerCivId}' to '{snapshot.PlayerCivId}'."));
        }

        var lastActive = lastSnapshot.ActiveCivs ?? Array.Empty<string>();
        if (!SequenceEquals(lastActive, snapshot.ActiveCivs ?? Array.Empty<string>()))
        {
            violations.Add(new SnapshotViolation(
                "CivRoster",
                "activeCivs ordering or membership changed since the last save."));
        }

        var lastCivs = lastSnapshot.CivStates?.Keys ?? Array.Empty<string>();
        if (!SetEquals(lastCivs, civStates.Keys))
        {
            violations.Add(new SnapshotViolation(
                "CivRoster",
                "civStates membership changed since the last save."));
        }

        if (activeCivs.Count > 0 && lastActive.Count > 0 && !SetEquals(activeCivs, lastActive))
        {
            violations.Add(new SnapshotViolation(
                "CivRoster",
                "activeCivs membership changed since the last save."));
        }
    }

    private static void ValidateTickSanity(
        GameState snapshot,
        GameState? lastSnapshot,
        List<SnapshotViolation> violations)
    {
        if (snapshot.TickCount < 0)
        {
            violations.Add(new SnapshotViolation(
                "TickSanity",
                $"tickCount {snapshot.TickCount} cannot be negative."));
        }

        if (lastSnapshot is null)
        {
            return;
        }

        if (snapshot.TickCount <= lastSnapshot.TickCount)
        {
            violations.Add(new SnapshotViolation(
                "TickSanity",
                $"tickCount {snapshot.TickCount} must exceed last save {lastSnapshot.TickCount}."));
        }
    }

    private static void ValidateMapSeedConsistency(
        GameState snapshot,
        GameState? lastSnapshot,
        List<SnapshotViolation> violations)
    {
        if (string.IsNullOrWhiteSpace(snapshot.MapSeed))
        {
            violations.Add(new SnapshotViolation(
                "MapSeedConsistency",
                "mapSeed is required."));
        }

        if (lastSnapshot is null)
        {
            return;
        }

        if (!string.Equals(snapshot.MapSeed, lastSnapshot.MapSeed, StringComparison.Ordinal))
        {
            violations.Add(new SnapshotViolation(
                "MapSeedConsistency",
                $"mapSeed '{snapshot.MapSeed}' does not match previous seed '{lastSnapshot.MapSeed}'."));
        }
    }

    private static TileIndex BuildTileIndex(
        IReadOnlyList<TileState> tiles,
        HashSet<string> activeCivs,
        List<SnapshotViolation> violations)
    {
        if (tiles.Count != SnapshotRules.ExpectedTileCount)
        {
            violations.Add(new SnapshotViolation(
                "TileGrid",
                $"tiles length {tiles.Count} must equal {SnapshotRules.ExpectedTileCount}."));
        }

        var index = new TileIndex();
        var duplicateIds = new HashSet<int>();

        foreach (var tile in tiles)
        {
            if (!index.ById.TryAdd(tile.Id, tile))
            {
                duplicateIds.Add(tile.Id);
                continue;
            }

            if (tile.Id < 0 || tile.Id >= SnapshotRules.ExpectedTileCount)
            {
                violations.Add(new SnapshotViolation(
                    "TileGrid",
                    $"tile id {tile.Id} is outside map bounds."));
            }

            if (!string.IsNullOrWhiteSpace(tile.Type) && !ValidTileTypes.Contains(tile.Type))
            {
                violations.Add(new SnapshotViolation(
                    "TileGrid",
                    $"tile {tile.Id} has invalid type '{tile.Type}'."));
            }

            if (tile.Owned && string.IsNullOrWhiteSpace(tile.OwnerId))
            {
                violations.Add(new SnapshotViolation(
                    "TileOwnership",
                    $"tile {tile.Id} is owned but ownerId is blank."));
            }

            if (!tile.Owned && !string.IsNullOrWhiteSpace(tile.OwnerId))
            {
                violations.Add(new SnapshotViolation(
                    "TileOwnership",
                    $"tile {tile.Id} has ownerId '{tile.OwnerId}' but owned=false."));
            }

            if (!string.IsNullOrWhiteSpace(tile.OwnerId) && activeCivs.Count > 0 && !activeCivs.Contains(tile.OwnerId))
            {
                violations.Add(new SnapshotViolation(
                    "TileOwnership",
                    $"tile {tile.Id} has ownerId '{tile.OwnerId}' not in activeCivs."));
            }
        }

        if (duplicateIds.Count > 0)
        {
            var sample = string.Join(", ", duplicateIds.Take(3));
            violations.Add(new SnapshotViolation(
                "TileGrid",
                $"tiles contain duplicate ids (e.g. {sample})."));
        }

        return index;
    }

    private static BuildingIndex BuildBuildingIndex(
        IReadOnlyList<BuildingState> buildings,
        HashSet<string> activeCivs,
        TileIndex tiles,
        List<SnapshotViolation> violations)
    {
        var index = new BuildingIndex();
        var duplicateIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var occupiedTiles = new Dictionary<int, string>();

        foreach (var building in buildings)
        {
            if (string.IsNullOrWhiteSpace(building.Id))
            {
                violations.Add(new SnapshotViolation(
                    "BuildingIntegrity",
                    "building id is required."));
                continue;
            }

            if (!index.ById.TryAdd(building.Id, building))
            {
                duplicateIds.Add(building.Id);
                continue;
            }

            if (string.IsNullOrWhiteSpace(building.OwnerId))
            {
                violations.Add(new SnapshotViolation(
                    "BuildingOwnership",
                    $"building '{building.Id}' has blank ownerId."));
            }
            else if (activeCivs.Count > 0 && !activeCivs.Contains(building.OwnerId))
            {
                violations.Add(new SnapshotViolation(
                    "BuildingOwnership",
                    $"building '{building.Id}' ownerId '{building.OwnerId}' is not in activeCivs."));
            }

            if (!BuildingCatalog.TryGetDefinition(building.Type, out _))
            {
                violations.Add(new SnapshotViolation(
                    "BuildingType",
                    $"building '{building.Id}' has unknown type '{building.Type}'."));
            }

            if (building.TileId < 0 || building.TileId >= SnapshotRules.ExpectedTileCount)
            {
                violations.Add(new SnapshotViolation(
                    "BuildingTile",
                    $"building '{building.Id}' has tileId {building.TileId} outside map bounds."));
            }

            if (building.ConstructionTicksRemaining < 0)
            {
                violations.Add(new SnapshotViolation(
                    "BuildingIntegrity",
                    $"building '{building.Id}' has negative constructionTicksRemaining."));
            }

            if (occupiedTiles.TryGetValue(building.TileId, out var existing))
            {
                violations.Add(new SnapshotViolation(
                    "BuildingTile",
                    $"tile {building.TileId} is claimed by both '{existing}' and '{building.Id}'."));
            }
            else
            {
                occupiedTiles[building.TileId] = building.Id;
            }

            var assignedWorkerIds = building.AssignedWorkerIds ?? Array.Empty<string>();
            if (assignedWorkerIds.Count != assignedWorkerIds.Distinct(StringComparer.OrdinalIgnoreCase).Count())
            {
                violations.Add(new SnapshotViolation(
                    "AssignmentConsistency",
                    $"building '{building.Id}' has duplicate assignedWorkerIds."));
            }

            if (tiles.ById.TryGetValue(building.TileId, out var tile))
            {
                if (!string.Equals(tile.BuildingId, building.Id, StringComparison.OrdinalIgnoreCase))
                {
                    violations.Add(new SnapshotViolation(
                        "BuildingTile",
                        $"tile {building.TileId} does not reference building '{building.Id}'."));
                }

                if (!tile.Owned)
                {
                    violations.Add(new SnapshotViolation(
                        "TileOwnership",
                        $"tile {building.TileId} contains building '{building.Id}' but is not owned."));
                }
                else if (!string.Equals(tile.OwnerId, building.OwnerId, StringComparison.OrdinalIgnoreCase))
                {
                    violations.Add(new SnapshotViolation(
                        "BuildingOwnership",
                        $"building '{building.Id}' ownerId '{building.OwnerId}' does not match tile owner '{tile.OwnerId}'."));
                }
            }
        }

        if (duplicateIds.Count > 0)
        {
            var sample = string.Join(", ", duplicateIds.Take(3));
            violations.Add(new SnapshotViolation(
                "BuildingIntegrity",
                $"buildings contain duplicate ids (e.g. {sample})."));
        }

        return index;
    }

    private static WorkerIndex BuildWorkerIndex(
        IReadOnlyList<WorkerState> workers,
        HashSet<string> activeCivs,
        BuildingIndex buildings,
        List<SnapshotViolation> violations)
    {
        var index = new WorkerIndex();
        var duplicateIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var worker in workers)
        {
            if (string.IsNullOrWhiteSpace(worker.Id))
            {
                violations.Add(new SnapshotViolation(
                    "WorkerIntegrity",
                    "worker id is required."));
                continue;
            }

            if (!index.ById.TryAdd(worker.Id, worker))
            {
                duplicateIds.Add(worker.Id);
                continue;
            }

            if (string.IsNullOrWhiteSpace(worker.OwnerId))
            {
                violations.Add(new SnapshotViolation(
                    "WorkerOwnership",
                    $"worker '{worker.Id}' has blank ownerId."));
            }
            else if (activeCivs.Count > 0 && !activeCivs.Contains(worker.OwnerId))
            {
                violations.Add(new SnapshotViolation(
                    "WorkerOwnership",
                    $"worker '{worker.Id}' ownerId '{worker.OwnerId}' is not in activeCivs."));
            }

            if (!ValidUnitTypes.Contains(worker.UnitType))
            {
                violations.Add(new SnapshotViolation(
                    "WorkerIntegrity",
                    $"worker '{worker.Id}' has invalid unitType '{worker.UnitType}'."));
            }

            if (!ValidWorkerStates.Contains(worker.State))
            {
                violations.Add(new SnapshotViolation(
                    "WorkerIntegrity",
                    $"worker '{worker.Id}' has invalid state '{worker.State}'."));
            }

            if (worker.Position is null)
            {
                violations.Add(new SnapshotViolation(
                    "WorkerIntegrity",
                    $"worker '{worker.Id}' has null position."));
            }
            else if (worker.Position.X < 0 || worker.Position.X >= SnapshotRules.MapWidth ||
                worker.Position.Y < 0 || worker.Position.Y >= SnapshotRules.MapHeight)
            {
                violations.Add(new SnapshotViolation(
                    "WorkerIntegrity",
                    $"worker '{worker.Id}' position ({worker.Position.X},{worker.Position.Y}) is outside map bounds."));
            }

            if (worker.HarvestTicks < 0)
            {
                violations.Add(new SnapshotViolation(
                    "WorkerIntegrity",
                    $"worker '{worker.Id}' has negative harvestTicks."));
            }

            if (worker.VisionRadius < 0)
            {
                violations.Add(new SnapshotViolation(
                    "WorkerIntegrity",
                    $"worker '{worker.Id}' has negative visionRadius."));
            }

            if (worker.Carrying is not null)
            {
                if (!TryParseResourceType(worker.Carrying.Type, out _))
                {
                    violations.Add(new SnapshotViolation(
                        "WorkerIntegrity",
                        $"worker '{worker.Id}' carrying invalid resource type '{worker.Carrying.Type}'."));
                }

                if (worker.Carrying.Amount < 0)
                {
                    violations.Add(new SnapshotViolation(
                        "WorkerIntegrity",
                        $"worker '{worker.Id}' carrying negative amount {worker.Carrying.Amount}."));
                }
            }

            if (!string.IsNullOrWhiteSpace(worker.AssignedBuildingId))
            {
                if (!buildings.ById.TryGetValue(worker.AssignedBuildingId, out var building))
                {
                    violations.Add(new SnapshotViolation(
                        "AssignmentConsistency",
                        $"worker '{worker.Id}' assignedBuildingId '{worker.AssignedBuildingId}' does not exist."));
                }
                else if (!string.Equals(worker.OwnerId, building.OwnerId, StringComparison.OrdinalIgnoreCase))
                {
                    violations.Add(new SnapshotViolation(
                        "AssignmentConsistency",
                        $"worker '{worker.Id}' assigned to building '{building.Id}' owned by '{building.OwnerId}'."));
                }
            }
        }

        if (duplicateIds.Count > 0)
        {
            var sample = string.Join(", ", duplicateIds.Take(3));
            violations.Add(new SnapshotViolation(
                "WorkerIntegrity",
                $"workers contain duplicate ids (e.g. {sample})."));
        }

        return index;
    }

    private static void ValidateTileBuildingLinks(
        TileIndex tiles,
        BuildingIndex buildings,
        List<SnapshotViolation> violations)
    {
        foreach (var tile in tiles.ById.Values)
        {
            if (string.IsNullOrWhiteSpace(tile.BuildingId))
            {
                continue;
            }

            if (!buildings.ById.ContainsKey(tile.BuildingId))
            {
                violations.Add(new SnapshotViolation(
                    "BuildingTile",
                    $"tile {tile.Id} references missing building '{tile.BuildingId}'."));
            }
        }
    }

    private static void ValidateTownHalls(
        HashSet<string> activeCivs,
        Dictionary<string, CivRuntimeState> civStates,
        BuildingIndex buildings,
        List<SnapshotViolation> violations)
    {
        foreach (var civId in activeCivs)
        {
            var townHalls = buildings.ById.Values
                .Where(b => string.Equals(b.OwnerId, civId, StringComparison.OrdinalIgnoreCase) &&
                            string.Equals(b.Type, BuildingCatalog.TownHall, StringComparison.OrdinalIgnoreCase))
                .ToList();

            if (townHalls.Count != 1)
            {
                violations.Add(new SnapshotViolation(
                    "TownHall",
                    $"civilization '{civId}' must have exactly one Town Hall (found {townHalls.Count})."));
            }

            if (civStates.TryGetValue(civId, out var civState))
            {
                if (civState.TownHallTileId is null)
                {
                    violations.Add(new SnapshotViolation(
                        "TownHall",
                        $"civilization '{civId}' must define townHallTileId."));
                }
                else if (townHalls.Count > 0 && civState.TownHallTileId != townHalls[0].TileId)
                {
                    violations.Add(new SnapshotViolation(
                        "TownHall",
                        $"civilization '{civId}' townHallTileId {civState.TownHallTileId} does not match Town Hall tile {townHalls[0].TileId}."));
                }
            }
        }
    }

    private static void ValidateAssignments(
        BuildingIndex buildings,
        WorkerIndex workers,
        List<SnapshotViolation> violations)
    {
        foreach (var building in buildings.ById.Values)
        {
            if (!BuildingCatalog.TryGetDefinition(building.Type, out var definition))
            {
                continue;
            }

            var assignedWorkerIds = building.AssignedWorkerIds ?? Array.Empty<string>();
            foreach (var workerId in assignedWorkerIds)
            {
                if (!workers.ById.TryGetValue(workerId, out var worker))
                {
                    violations.Add(new SnapshotViolation(
                        "AssignmentConsistency",
                        $"building '{building.Id}' assignedWorkerId '{workerId}' does not exist."));
                    continue;
                }

                if (!string.Equals(worker.AssignedBuildingId, building.Id, StringComparison.OrdinalIgnoreCase))
                {
                    violations.Add(new SnapshotViolation(
                        "AssignmentConsistency",
                        $"building '{building.Id}' lists worker '{workerId}', but worker assignedBuildingId is '{worker.AssignedBuildingId}'."));
                }
            }

            if (building.ConstructionTicksRemaining > 0 && assignedWorkerIds.Count > 1)
            {
                violations.Add(new SnapshotViolation(
                    "AssignmentConsistency",
                    $"building '{building.Id}' has {assignedWorkerIds.Count} workers while under construction."));
            }

            if (building.ConstructionTicksRemaining == 0)
            {
                if (definition.RequiredWorkers == 0 && assignedWorkerIds.Count > 0)
                {
                    violations.Add(new SnapshotViolation(
                        "AssignmentConsistency",
                        $"building '{building.Id}' does not accept workers but has {assignedWorkerIds.Count} assigned."));
                }
                else if (definition.RequiredWorkers > 0 && assignedWorkerIds.Count > definition.RequiredWorkers)
                {
                    violations.Add(new SnapshotViolation(
                        "AssignmentConsistency",
                        $"building '{building.Id}' exceeds requiredWorkers ({assignedWorkerIds.Count}/{definition.RequiredWorkers})."));
                }
            }

            var isConstructed = building.ConstructionTicksRemaining == 0;
            var shouldBeStaffed = isConstructed && assignedWorkerIds.Count >= definition.RequiredWorkers;
            var shouldBeOperational = shouldBeStaffed && isConstructed;

            if (building.Staffed != shouldBeStaffed)
            {
                violations.Add(new SnapshotViolation(
                    "BuildingIntegrity",
                    $"building '{building.Id}' staffed flag mismatch (expected {shouldBeStaffed})."));
            }

            if (building.Operational != shouldBeOperational)
            {
                violations.Add(new SnapshotViolation(
                    "BuildingIntegrity",
                    $"building '{building.Id}' operational flag mismatch (expected {shouldBeOperational})."));
            }
        }

        foreach (var worker in workers.ById.Values)
        {
            if (string.IsNullOrWhiteSpace(worker.AssignedBuildingId))
            {
                continue;
            }

            if (!buildings.ById.TryGetValue(worker.AssignedBuildingId, out var building))
            {
                continue;
            }

            var assignedWorkerIds = building.AssignedWorkerIds ?? Array.Empty<string>();
            if (!assignedWorkerIds.Any(id => string.Equals(id, worker.Id, StringComparison.OrdinalIgnoreCase)))
            {
                violations.Add(new SnapshotViolation(
                    "AssignmentConsistency",
                    $"worker '{worker.Id}' assigned to building '{building.Id}' but not listed in assignedWorkerIds."));
            }
        }
    }

    private static void ValidateEraGate(
        HashSet<string> activeCivs,
        Dictionary<string, CivRuntimeState> civStates,
        BuildingIndex buildings,
        List<SnapshotViolation> violations)
    {
        foreach (var civId in activeCivs)
        {
            if (!civStates.TryGetValue(civId, out var civState))
            {
                continue;
            }

            var invalid = new List<(string Type, int RequiredEra)>();
            foreach (var building in buildings.ById.Values.Where(b =>
                         string.Equals(b.OwnerId, civId, StringComparison.OrdinalIgnoreCase)))
            {
                if (!BuildingCatalog.TryGetDefinition(building.Type, out var definition))
                {
                    continue;
                }

                if (definition.RequiredEra > civState.Era)
                {
                    invalid.Add((building.Type, definition.RequiredEra));
                }
            }

            if (invalid.Count == 0)
            {
                continue;
            }

            var examples = string.Join(
                ", ",
                invalid
                    .Select(entry => $"{entry.Type} (requires era {entry.RequiredEra})")
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .Take(3));

            violations.Add(new SnapshotViolation(
                "EraGate",
                $"{invalid.Count} building(s) exceed era {civState.Era} for civ '{civId}'. Examples: {examples}."));
        }
    }

    private static void ValidateWorkerCap(
        HashSet<string> activeCivs,
        BuildingIndex buildings,
        WorkerIndex workers,
        List<SnapshotViolation> violations)
    {
        foreach (var civId in activeCivs)
        {
            var civWorkers = workers.ById.Values
                .Where(worker => string.Equals(worker.OwnerId, civId, StringComparison.OrdinalIgnoreCase))
                .ToList();

            var capacity = buildings.ById.Values
                .Where(building =>
                    string.Equals(building.OwnerId, civId, StringComparison.OrdinalIgnoreCase) &&
                    building.ConstructionTicksRemaining <= 0)
                .Sum(building => BuildingCatalog.GetHousingCapacity(building.Type));

            if (civWorkers.Count > capacity)
            {
                violations.Add(new SnapshotViolation(
                    "WorkerCap",
                    $"{civWorkers.Count} workers exceed housing capacity {capacity} for civ '{civId}'."));
            }
        }
    }

    private static void ValidateResourceCap(
        HashSet<string> activeCivs,
        Dictionary<string, CivRuntimeState> civStates,
        BuildingIndex buildings,
        WorkerIndex workers,
        long tickCount,
        List<SnapshotViolation> violations)
    {
        foreach (var civId in activeCivs)
        {
            if (!civStates.TryGetValue(civId, out var civState) || civState.Resources is null)
            {
                continue;
            }

            var maxTotals = ComputeMaxResources(civId, buildings, workers, tickCount);
            ValidateResource("food", civState.Resources.Food, maxTotals.Food, tickCount, violations, civId);
            ValidateResource("wood", civState.Resources.Wood, maxTotals.Wood, tickCount, violations, civId);
            ValidateResource("stone", civState.Resources.Stone, maxTotals.Stone, tickCount, violations, civId);
            ValidateResource("knowledge", civState.Resources.Knowledge, maxTotals.Knowledge, tickCount, violations, civId);
        }
    }

    private static void ValidateResource(
        string resourceName,
        int current,
        long max,
        long tickCount,
        List<SnapshotViolation> violations,
        string civId)
    {
        if (current < 0)
        {
            violations.Add(new SnapshotViolation(
                "ResourceCap",
                $"{resourceName} {current} cannot be negative for civ '{civId}'."));
            return;
        }

        if (current > max)
        {
            violations.Add(new SnapshotViolation(
                "ResourceCap",
                $"{resourceName} {current} exceeds computed max {max} for tick {tickCount} (civ '{civId}')."));
        }
    }

    private static ResourceTotals ComputeMaxResources(
        string civId,
        BuildingIndex buildings,
        WorkerIndex workers,
        long tickCount)
    {
        var safeTickCount = Math.Max(0, tickCount);
        var civBuildings = buildings.ById.Values
            .Where(building => string.Equals(building.OwnerId, civId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        var storageCapacity = SnapshotRules.BaseStorageCapacity +
            civBuildings.Count(
                building => building.ConstructionTicksRemaining <= 0 &&
                    string.Equals(building.Type, BuildingCatalog.Storehouse, StringComparison.OrdinalIgnoreCase)) *
            SnapshotRules.StorehouseCapacityBonus;

        var civDefinition = CivilizationCatalog.GetDefinitionOrDefault(civId);

        var perTickProduction = new ResourceTotals();
        foreach (var building in civBuildings)
        {
            if (building.ConstructionTicksRemaining > 0)
            {
                continue;
            }

            if (!BuildingCatalog.TryGetDefinition(building.Type, out var definition))
            {
                continue;
            }

            if (definition.Resource is null)
            {
                continue;
            }

            var requiredWorkers = Math.Max(0, definition.RequiredWorkers);
            var assignedCount = building.AssignedWorkerIds?.Count ?? 0;
            var isOperational = requiredWorkers == 0
                ? assignedCount == 0
                : assignedCount >= requiredWorkers;

            if (!isOperational)
            {
                continue;
            }

            var multiplier = civDefinition.YieldMultipliers.TryGetValue(definition.Resource.Value, out var bonus)
                ? bonus
                : 1m;
            var yieldAmount = ApplyMultiplier(definition.YieldAmount, multiplier);
            perTickProduction = perTickProduction.Add(definition.Resource.Value, yieldAmount);
        }

        var workerHarvest = ComputeWorkerHarvest(civId, civBuildings, workers, safeTickCount);
        var starterResources = GetStarterTotals(civDefinition);
        var baseTotals = perTickProduction.Multiply(safeTickCount) + workerHarvest + starterResources;
        var storageTotals = new ResourceTotals(storageCapacity, storageCapacity, storageCapacity, storageCapacity);

        return ResourceTotals.Min(baseTotals, storageTotals);
    }

    private static ResourceTotals ComputeWorkerHarvest(
        string civId,
        IReadOnlyList<BuildingState> civBuildings,
        WorkerIndex workers,
        long tickCount)
    {
        if (tickCount <= 0)
        {
            return new ResourceTotals();
        }

        var assignments = workers.ById.Values
            .Where(worker =>
                string.Equals(worker.OwnerId, civId, StringComparison.OrdinalIgnoreCase) &&
                !string.IsNullOrWhiteSpace(worker.AssignedBuildingId))
            .GroupBy(worker => worker.AssignedBuildingId!, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.Count(), StringComparer.OrdinalIgnoreCase);

        var totals = new ResourceTotals();

        foreach (var building in civBuildings)
        {
            if (building.ConstructionTicksRemaining > 0)
            {
                continue;
            }

            if (!assignments.TryGetValue(building.Id, out var workerCount) || workerCount <= 0)
            {
                continue;
            }

            if (!BuildingCatalog.TryGetDefinition(building.Type, out var definition))
            {
                continue;
            }

            if (definition.Resource is null || definition.TicksToHarvest <= 0)
            {
                continue;
            }

            var cycles = tickCount / definition.TicksToHarvest;
            if (cycles <= 0)
            {
                continue;
            }

            var totalYield = cycles * definition.YieldAmount * workerCount;
            totals = totals.Add(definition.Resource.Value, totalYield);
        }

        return totals;
    }

    private static ResourceTotals GetStarterTotals(CivilizationDefinition civDefinition)
    {
        var baseResources = SnapshotRules.StarterResources;
        var bonus = civDefinition.StartingResources ?? new ResourcePool();

        return new ResourceTotals(
            baseResources.Food + bonus.Food,
            baseResources.Wood + bonus.Wood,
            baseResources.Stone + bonus.Stone,
            baseResources.Knowledge + bonus.Knowledge);
    }

    private static long ApplyMultiplier(int amount, decimal multiplier)
    {
        if (amount <= 0)
        {
            return 0;
        }

        var scaled = amount * multiplier;
        return (long)Math.Ceiling(scaled);
    }

    private static bool TryParseResourceType(string? value, out ResourceType type)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            type = default;
            return false;
        }

        return Enum.TryParse(value, ignoreCase: true, out type);
    }

    private static bool SequenceEquals(IReadOnlyList<string> left, IReadOnlyList<string> right)
    {
        if (left.Count != right.Count)
        {
            return false;
        }

        for (var i = 0; i < left.Count; i++)
        {
            if (!string.Equals(left[i], right[i], StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }
        }

        return true;
    }

    private static bool SetEquals(IEnumerable<string> left, IEnumerable<string> right)
    {
        var leftSet = new HashSet<string>(left, StringComparer.OrdinalIgnoreCase);
        var rightSet = new HashSet<string>(right, StringComparer.OrdinalIgnoreCase);
        return leftSet.SetEquals(rightSet);
    }

    private sealed class TileIndex
    {
        public Dictionary<int, TileState> ById { get; } = new();
    }

    private sealed class BuildingIndex
    {
        public Dictionary<string, BuildingState> ById { get; } =
            new(StringComparer.OrdinalIgnoreCase);
    }

    private sealed class WorkerIndex
    {
        public Dictionary<string, WorkerState> ById { get; } =
            new(StringComparer.OrdinalIgnoreCase);
    }

    private readonly record struct ResourceTotals(long Food, long Wood, long Stone, long Knowledge)
    {
        public ResourceTotals() : this(0, 0, 0, 0)
        {
        }

        public ResourceTotals Add(ResourceType type, long amount)
        {
            return type switch
            {
                ResourceType.Food => this with { Food = Food + amount },
                ResourceType.Wood => this with { Wood = Wood + amount },
                ResourceType.Stone => this with { Stone = Stone + amount },
                ResourceType.Knowledge => this with { Knowledge = Knowledge + amount },
                _ => this,
            };
        }

        public ResourceTotals Multiply(long factor)
        {
            return new ResourceTotals(
                Food * factor,
                Wood * factor,
                Stone * factor,
                Knowledge * factor);
        }

        public static ResourceTotals Min(ResourceTotals left, ResourceTotals right)
        {
            return new ResourceTotals(
                Math.Min(left.Food, right.Food),
                Math.Min(left.Wood, right.Wood),
                Math.Min(left.Stone, right.Stone),
                Math.Min(left.Knowledge, right.Knowledge));
        }

        public static ResourceTotals operator +(ResourceTotals left, ResourceTotals right)
        {
            return new ResourceTotals(
                left.Food + right.Food,
                left.Wood + right.Wood,
                left.Stone + right.Stone,
                left.Knowledge + right.Knowledge);
        }
    }
}
