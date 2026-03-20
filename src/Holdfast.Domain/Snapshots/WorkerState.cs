namespace Holdfast.Domain.Snapshots;

public sealed record WorkerState
{
    public WorkerState()
    {
    }

    public WorkerState(
        string id,
        string ownerId,
        string unitType,
        string state,
        string? assignedBuildingId,
        TileCoordinate position,
        IReadOnlyList<TileCoordinate> path,
        int harvestTicks,
        ResourceUnit? carrying,
        int visionRadius)
    {
        Id = id;
        OwnerId = ownerId;
        UnitType = unitType;
        State = state;
        AssignedBuildingId = assignedBuildingId;
        Position = position;
        Path = path;
        HarvestTicks = harvestTicks;
        Carrying = carrying;
        VisionRadius = visionRadius;
    }

    public string Id { get; init; } = string.Empty;

    public string OwnerId { get; init; } = string.Empty;

    public string UnitType { get; init; } = string.Empty;

    public string State { get; init; } = string.Empty;

    public string? AssignedBuildingId { get; init; }

    public TileCoordinate Position { get; init; } = new();

    public IReadOnlyList<TileCoordinate> Path { get; init; } = Array.Empty<TileCoordinate>();

    public int HarvestTicks { get; init; }

    public ResourceUnit? Carrying { get; init; }

    public int VisionRadius { get; init; }
}
