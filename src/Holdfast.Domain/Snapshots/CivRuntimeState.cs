namespace Holdfast.Domain.Snapshots;

public sealed record CivRuntimeState
{
    public CivRuntimeState()
    {
    }

    public CivRuntimeState(
        string civilizationId,
        ResourcePool resources,
        int era,
        bool autoPlay,
        int? townHallTileId)
    {
        CivilizationId = civilizationId;
        Resources = resources;
        Era = era;
        AutoPlay = autoPlay;
        TownHallTileId = townHallTileId;
    }

    public string CivilizationId { get; init; } = string.Empty;

    public ResourcePool Resources { get; init; } = new();

    public int Era { get; init; }

    public bool AutoPlay { get; init; }

    public int? TownHallTileId { get; init; }
}
