namespace Holdfast.Domain.Tests;

using Holdfast.Domain.Snapshots;
using Holdfast.Domain.Validation;

public class SnapshotValidatorTests
{
    [Fact]
    public void ResourceCap_Fails_WhenResourceExceedsCapacity()
    {
        var validator = new SnapshotValidator();
        var buildings = new List<BuildingState>
        {
            CreateBuilding(BuildingCatalog.TownHall),
        };
        var snapshot = CreateSnapshot(
            resources: new ResourcePool(food: 999, wood: 0, stone: 0, knowledge: 0),
            buildings: buildings);

        var result = validator.Validate(snapshot, null);

        Assert.False(result.IsValid);
        Assert.Contains(result.Violations, violation => violation.Rule == "ResourceCap");
    }

    [Fact]
    public void EraGate_Fails_ForHigherTierBuilding()
    {
        var validator = new SnapshotValidator();
        var buildings = new List<BuildingState>
        {
            CreateBuilding(BuildingCatalog.Farm),
        };
        var snapshot = CreateSnapshot(era: 1, buildings: buildings);

        var result = validator.Validate(snapshot, null);

        Assert.False(result.IsValid);
        Assert.Contains(result.Violations, violation => violation.Rule == "EraGate");
    }

    [Fact]
    public void WorkerCap_Fails_WhenExceedsHousing()
    {
        var validator = new SnapshotValidator();
        var buildings = new List<BuildingState>
        {
            CreateBuilding(BuildingCatalog.TownHall),
        };
        var workers = new List<WorkerState>
        {
            CreateWorker("w-0"),
            CreateWorker("w-1"),
            CreateWorker("w-2"),
            CreateWorker("w-3"),
        };

        var snapshot = CreateSnapshot(buildings: buildings, workers: workers);

        var result = validator.Validate(snapshot, null);

        Assert.False(result.IsValid);
        Assert.Contains(result.Violations, violation => violation.Rule == "WorkerCap");
    }

    [Fact]
    public void TickSanity_Fails_WhenNotGreaterThanLastSave()
    {
        var validator = new SnapshotValidator();
        var lastSnapshot = CreateSnapshot(tickCount: 10);
        var snapshot = CreateSnapshot(tickCount: 10);

        var result = validator.Validate(snapshot, lastSnapshot);

        Assert.False(result.IsValid);
        Assert.Contains(result.Violations, violation => violation.Rule == "TickSanity");
    }

    [Fact]
    public void MapSeedConsistency_Fails_WhenSeedChanges()
    {
        var validator = new SnapshotValidator();
        var lastSnapshot = CreateSnapshot(mapSeed: "seed-a");
        var snapshot = CreateSnapshot(mapSeed: "seed-b");

        var result = validator.Validate(snapshot, lastSnapshot);

        Assert.False(result.IsValid);
        Assert.Contains(result.Violations, violation => violation.Rule == "MapSeedConsistency");
    }

    [Fact]
    public void ValidSnapshot_Passes_AllChecks()
    {
        var validator = new SnapshotValidator();
        var buildings = new List<BuildingState>
        {
            CreateBuilding(BuildingCatalog.TownHall),
            CreateBuilding(BuildingCatalog.Storehouse),
        };
        var workers = new List<WorkerState>
        {
            CreateWorker("w-0"),
            CreateWorker("w-1"),
            CreateWorker("w-2"),
        };
        var snapshot = CreateSnapshot(
            tickCount: 5,
            resources: new ResourcePool(food: 30, wood: 0, stone: 0, knowledge: 0),
            buildings: buildings,
            workers: workers);

        var result = validator.Validate(snapshot, null);

        Assert.True(result.IsValid);
        Assert.Empty(result.Violations);
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
