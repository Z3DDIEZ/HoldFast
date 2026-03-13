namespace Holdfast.Domain.Snapshots;

public sealed record WorkerState
{
    public WorkerState()
    {
    }

    public WorkerState(
        string id,
        string state,
        string? assignedBuildingId,
        TileCoordinate position,
        IReadOnlyList<TileCoordinate> path,
        int harvestTicks,
        ResourceUnit? carrying)
    {
        Id = id;
        State = state;
        AssignedBuildingId = assignedBuildingId;
        Position = position;
        Path = path;
        HarvestTicks = harvestTicks;
        Carrying = carrying;
    }

    public string Id { get; init; } = string.Empty;

    public string State { get; init; } = string.Empty;

    public string? AssignedBuildingId { get; init; }

    public TileCoordinate Position { get; init; } = new();

    public IReadOnlyList<TileCoordinate> Path { get; init; } = Array.Empty<TileCoordinate>();

    public int HarvestTicks { get; init; }

    public ResourceUnit? Carrying { get; init; }
}
