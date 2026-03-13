namespace Holdfast.Application.Validation;

using Holdfast.Domain.Snapshots;
using Holdfast.Domain.Validation;
using MediatR;

public sealed record ValidateSnapshotCommand(string UserId, GameState Snapshot) : IRequest<SnapshotValidationResult>;
