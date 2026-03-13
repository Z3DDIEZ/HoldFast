namespace Holdfast.Domain.Snapshots;

public sealed record GameState
{
    public GameState()
    {
    }

    public GameState(
        string mapSeed,
        long tickCount,
        int era,
        ResourcePool resources,
        IReadOnlyList<TileState> tiles,
        IReadOnlyList<WorkerState> workers,
        IReadOnlyList<BuildingState> buildings,
        DateTimeOffset? savedAt)
    {
        MapSeed = mapSeed;
        TickCount = tickCount;
        Era = era;
        Resources = resources;
        Tiles = tiles;
        Workers = workers;
        Buildings = buildings;
        SavedAt = savedAt;
    }

    public string MapSeed { get; init; } = string.Empty;

    public long TickCount { get; init; }

    public int Era { get; init; }

    public ResourcePool Resources { get; init; } = new();

    public IReadOnlyList<TileState> Tiles { get; init; } = Array.Empty<TileState>();

    public IReadOnlyList<WorkerState> Workers { get; init; } = Array.Empty<WorkerState>();

    public IReadOnlyList<BuildingState> Buildings { get; init; } = Array.Empty<BuildingState>();

    public DateTimeOffset? SavedAt { get; init; }
}
