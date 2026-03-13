namespace Holdfast.Domain.Validation;

public sealed record SnapshotValidationResult
{
    public SnapshotValidationResult()
    {
    }

    public SnapshotValidationResult(IReadOnlyList<SnapshotViolation> violations)
    {
        Violations = violations;
        IsValid = violations.Count == 0;
    }

    public bool IsValid { get; init; }

    public IReadOnlyList<SnapshotViolation> Violations { get; init; } = Array.Empty<SnapshotViolation>();

    public static SnapshotValidationResult Valid() => new(Array.Empty<SnapshotViolation>());
}
