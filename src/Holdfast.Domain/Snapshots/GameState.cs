namespace Holdfast.Domain.Snapshots;

public sealed record GameState
{
    public GameState()
    {
    }

    public GameState(
        string mapSeed,
        string playerCivId,
        IReadOnlyList<string> activeCivs,
        IReadOnlyDictionary<string, CivRuntimeState> civStates,
        long tickCount,
        IReadOnlyList<TileState> tiles,
        IReadOnlyList<WorkerState> workers,
        IReadOnlyList<BuildingState> buildings,
        DateTimeOffset? savedAt)
    {
        MapSeed = mapSeed;
        PlayerCivId = playerCivId;
        ActiveCivs = activeCivs;
        CivStates = civStates;
        TickCount = tickCount;
        Tiles = tiles;
        Workers = workers;
        Buildings = buildings;
        SavedAt = savedAt;
    }

    public string MapSeed { get; init; } = string.Empty;

    public string PlayerCivId { get; init; } = string.Empty;

    public IReadOnlyList<string> ActiveCivs { get; init; } = Array.Empty<string>();

    public IReadOnlyDictionary<string, CivRuntimeState> CivStates { get; init; } =
        new Dictionary<string, CivRuntimeState>(StringComparer.OrdinalIgnoreCase);

    public long TickCount { get; init; }

    public IReadOnlyList<TileState> Tiles { get; init; } = Array.Empty<TileState>();

    public IReadOnlyList<WorkerState> Workers { get; init; } = Array.Empty<WorkerState>();

    public IReadOnlyList<BuildingState> Buildings { get; init; } = Array.Empty<BuildingState>();

    public DateTimeOffset? SavedAt { get; init; }
}
