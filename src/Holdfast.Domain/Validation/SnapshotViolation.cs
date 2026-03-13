namespace Holdfast.Domain.Validation;

public sealed record SnapshotViolation
{
    public SnapshotViolation()
    {
    }

    public SnapshotViolation(string rule, string detail)
    {
        Rule = rule;
        Detail = detail;
    }

    public string Rule { get; init; } = string.Empty;

    public string Detail { get; init; } = string.Empty;
}
