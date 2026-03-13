namespace Holdfast.Domain.Snapshots;

public sealed record ResourcePool
{
    public ResourcePool()
    {
    }

    public ResourcePool(int food, int wood, int stone, int knowledge)
    {
        Food = food;
        Wood = wood;
        Stone = stone;
        Knowledge = knowledge;
    }

    public int Food { get; init; }

    public int Wood { get; init; }

    public int Stone { get; init; }

    public int Knowledge { get; init; }
}
