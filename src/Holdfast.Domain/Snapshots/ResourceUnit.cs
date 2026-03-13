namespace Holdfast.Domain.Snapshots;

public sealed record ResourceUnit
{
    public ResourceUnit()
    {
    }

    public ResourceUnit(string type, int amount)
    {
        Type = type;
        Amount = amount;
    }

    public string Type { get; init; } = string.Empty;

    public int Amount { get; init; }
}
