namespace Holdfast.Api.Contracts;

using Holdfast.Domain.Validation;

public sealed record SnapshotValidationResponse
{
    public SnapshotValidationResponse()
    {
    }

    public SnapshotValidationResponse(bool valid, IReadOnlyList<SnapshotViolation> violations)
    {
        Valid = valid;
        Violations = violations;
    }

    public bool Valid { get; init; }

    public IReadOnlyList<SnapshotViolation> Violations { get; init; } = Array.Empty<SnapshotViolation>();
}
