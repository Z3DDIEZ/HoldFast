namespace Holdfast.Domain.Snapshots;

public sealed record TileState
{
    public TileState()
    {
    }

    public TileState(
        int id,
        string type,
        bool owned,
        string? ownerId,
        bool walkable,
        bool visible,
        string? buildingId)
    {
        Id = id;
        Type = type;
        Owned = owned;
        OwnerId = ownerId;
        Walkable = walkable;
        Visible = visible;
        BuildingId = buildingId;
    }

    public int Id { get; init; }

    public string Type { get; init; } = string.Empty;

    public bool Owned { get; init; }

    public string? OwnerId { get; init; }

    public bool Walkable { get; init; }

    public bool Visible { get; init; }

    public string? BuildingId { get; init; }
}
