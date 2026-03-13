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
            buildings: new List<BuildingState> { CreateBuilding(BuildingCatalog.Farm) });

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
        string mapSeed = "seed")
    {
        return new GameState(
            mapSeed,
            tickCount,
            era,
            resources ?? new ResourcePool(0, 0, 0, 0),
            tiles ?? Array.Empty<TileState>(),
            workers ?? Array.Empty<WorkerState>(),
            buildings ?? Array.Empty<BuildingState>(),
            DateTimeOffset.UtcNow);
    }

    private static BuildingState CreateBuilding(string type, int constructionTicksRemaining = 0)
    {
        return new BuildingState(
            id: $"b-{type}",
            type: type,
            tileId: 0,
            tier: 1,
            constructionTicksRemaining: constructionTicksRemaining,
            constructionWorkerId: null,
            staffed: false,
            operational: false,
            assignedWorkerIds: Array.Empty<string>());
    }

    private static WorkerState CreateWorker(string id, string? assignedBuildingId = null)
    {
        return new WorkerState(
            id,
            state: "IDLE",
            assignedBuildingId: assignedBuildingId,
            position: new TileCoordinate(0, 0),
            path: Array.Empty<TileCoordinate>(),
            harvestTicks: 0,
            carrying: null);
    }
}
