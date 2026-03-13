namespace Holdfast.Domain.Saves;

using Holdfast.Domain.Snapshots;

public sealed record GameSave
{
    public GameSave()
    {
    }

    public GameSave(
        Guid id,
        string userId,
        string mapSeed,
        long tickCount,
        GameState snapshot,
        DateTimeOffset savedAt)
    {
        Id = id;
        UserId = userId;
        MapSeed = mapSeed;
        TickCount = tickCount;
        Snapshot = snapshot;
        SavedAt = savedAt;
    }

    public Guid Id { get; init; }

    public string UserId { get; init; } = string.Empty;

    public string MapSeed { get; init; } = string.Empty;

    public long TickCount { get; init; }

    public GameState Snapshot { get; init; } = new();

    public DateTimeOffset SavedAt { get; init; }
}
