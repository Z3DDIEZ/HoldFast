namespace Holdfast.Application.Tests;

using Holdfast.Application.Saves;
using Holdfast.Domain.Snapshots;
using Holdfast.Domain.Validation;
using Holdfast.Infrastructure.Persistence;

public class SaveGameCommandHandlerTests
{
    [Fact]
    public async Task SaveGameCommand_ReturnsViolations_WhenInvalid()
    {
        var repository = new InMemoryGameSaveRepository();
        var validator = new SnapshotValidator();
        var handler = new SaveGameCommandHandler(repository, validator);

        var snapshot = CreateSnapshot(
            era: 1,
            buildings: new List<BuildingState> { CreateBuilding(BuildingCatalog.Farm, tileId: 1) });

        var result = await handler.Handle(new SaveGameCommand("user-1", snapshot), CancellationToken.None);

        Assert.False(result.IsValid);
        Assert.Contains(result.Violations, violation => violation.Rule == "EraGate");
    }

    [Fact]
    public async Task SaveGameCommand_PersistsSnapshot_WhenValid()
    {
        var repository = new InMemoryGameSaveRepository();
        var validator = new SnapshotValidator();
        var handler = new SaveGameCommandHandler(repository, validator);

        var snapshot = CreateSnapshot(
            tickCount: 5,
            buildings: new List<BuildingState> { CreateBuilding(BuildingCatalog.TownHall) },
            workers: new List<WorkerState> { CreateWorker("w-0"), CreateWorker("w-1"), CreateWorker("w-2") });

        var result = await handler.Handle(new SaveGameCommand("user-1", snapshot), CancellationToken.None);

        Assert.True(result.IsValid);
        Assert.NotNull(result.SaveId);
        Assert.NotNull(result.SavedAt);

        var latest = await repository.GetLatestAsync("user-1", CancellationToken.None);
        Assert.NotNull(latest);
        Assert.Equal(result.SaveId, latest!.Id);
    }

    [Fact]
    public async Task LoadGameQuery_ReturnsLatestSnapshot()
    {
        var repository = new InMemoryGameSaveRepository();
        var validator = new SnapshotValidator();
        var saveHandler = new SaveGameCommandHandler(repository, validator);
        var loadHandler = new LoadGameQueryHandler(repository);

        var snapshot = CreateSnapshot(tickCount: 7);
        await saveHandler.Handle(new SaveGameCommand("user-2", snapshot), CancellationToken.None);

        var loaded = await loadHandler.Handle(new LoadGameQuery("user-2"), CancellationToken.None);

        Assert.NotNull(loaded);
        Assert.Equal(7, loaded!.TickCount);
    }

    private static GameState CreateSnapshot(
        long tickCount = 1,
        int era = 1,
        ResourcePool? resources = null,
        IReadOnlyList<TileState>? tiles = null,
        IReadOnlyList<WorkerState>? workers = null,
        IReadOnlyList<BuildingState>? buildings = null,
        string mapSeed = "seed",
        string civId = "franks")
    {
        var tileList = tiles?.ToList() ?? CreateTiles();
        var buildingList = buildings?.ToList() ?? new List<BuildingState>();

        var townHall = buildingList.FirstOrDefault(b =>
            string.Equals(b.Type, BuildingCatalog.TownHall, StringComparison.OrdinalIgnoreCase) &&
            string.Equals(b.OwnerId, civId, StringComparison.OrdinalIgnoreCase));
        if (townHall is null)
        {
            townHall = CreateBuilding(BuildingCatalog.TownHall, ownerId: civId, tileId: 0);
            buildingList.Add(townHall);
        }

        foreach (var building in buildingList)
        {
            if (building.TileId >= 0 && building.TileId < tileList.Count)
            {
                var tile = tileList[building.TileId];
                tileList[building.TileId] = tile with
                {
                    BuildingId = building.Id,
                    Owned = true,
                    OwnerId = building.OwnerId,
                };
            }
        }

        var workerList = workers?.ToList() ?? new List<WorkerState>();
        var civState = new CivRuntimeState(
            civId,
            resources ?? new ResourcePool(0, 0, 0, 0),
            era,
            autoPlay: false,
            townHallTileId: townHall.TileId);

        return new GameState(
            mapSeed,
            civId,
            new List<string> { civId },
            new Dictionary<string, CivRuntimeState> { [civId] = civState },
            tickCount,
            tileList,
            workerList,
            buildingList,
            DateTimeOffset.UtcNow);
    }

    private static List<TileState> CreateTiles()
    {
        var tiles = new List<TileState>(SnapshotRules.ExpectedTileCount);
        for (var i = 0; i < SnapshotRules.ExpectedTileCount; i++)
        {
            tiles.Add(new TileState(
                id: i,
                type: "GRASSLAND",
                owned: false,
                ownerId: null,
                walkable: true,
                visible: true,
                buildingId: null));
        }

        return tiles;
    }

    private static BuildingState CreateBuilding(
        string type,
        string ownerId = "franks",
        int tileId = 0,
        int constructionTicksRemaining = 0,
        IReadOnlyList<string>? assignedWorkerIds = null)
    {
        var assigned = assignedWorkerIds ?? Array.Empty<string>();
        var requiredWorkers = BuildingCatalog.TryGetDefinition(type, out var definition)
            ? definition.RequiredWorkers
            : 0;
        var isConstructed = constructionTicksRemaining == 0;
        var staffed = isConstructed && assigned.Count >= requiredWorkers;
        var operational = staffed && isConstructed;

        return new BuildingState(
            id: $"b-{ownerId}-{type}-{tileId}",
            ownerId: ownerId,
            type: type,
            tileId: tileId,
            tier: 1,
            constructionTicksRemaining: constructionTicksRemaining,
            constructionWorkerId: null,
            staffed: staffed,
            operational: operational,
            assignedWorkerIds: assigned);
    }

    private static WorkerState CreateWorker(string id, string? assignedBuildingId = null, string ownerId = "franks")
    {
        return new WorkerState(
            id,
            ownerId,
            unitType: "WORKER",
            state: "IDLE",
            assignedBuildingId: assignedBuildingId,
            position: new TileCoordinate(0, 0),
            path: Array.Empty<TileCoordinate>(),
            harvestTicks: 0,
            carrying: null,
            visionRadius: 2);
    }
}
