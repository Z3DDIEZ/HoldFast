namespace Holdfast.Domain.Snapshots;

public sealed record BuildingState
{
    public BuildingState()
    {
    }

    public BuildingState(
        string id,
        string ownerId,
        string type,
        int tileId,
        int tier,
        int constructionTicksRemaining,
        string? constructionWorkerId,
        bool staffed,
        bool operational,
        IReadOnlyList<string> assignedWorkerIds)
    {
        Id = id;
        OwnerId = ownerId;
        Type = type;
        TileId = tileId;
        Tier = tier;
        ConstructionTicksRemaining = constructionTicksRemaining;
        ConstructionWorkerId = constructionWorkerId;
        Staffed = staffed;
        Operational = operational;
        AssignedWorkerIds = assignedWorkerIds;
    }

    public string Id { get; init; } = string.Empty;

    public string OwnerId { get; init; } = string.Empty;

    public string Type { get; init; } = string.Empty;

    public int TileId { get; init; }

    public int Tier { get; init; }

    public int ConstructionTicksRemaining { get; init; }

    public string? ConstructionWorkerId { get; init; }

    public bool Staffed { get; init; }

    public bool Operational { get; init; }

    public IReadOnlyList<string> AssignedWorkerIds { get; init; } = Array.Empty<string>();
}
