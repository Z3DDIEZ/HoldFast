namespace Holdfast.Application.Validation;

using Holdfast.Application.Saves;
using Holdfast.Domain.Validation;
using MediatR;

public sealed class ValidateSnapshotCommandHandler : IRequestHandler<ValidateSnapshotCommand, SnapshotValidationResult>
{
    private readonly IGameSaveRepository _repository;
    private readonly SnapshotValidator _validator;

    public ValidateSnapshotCommandHandler(IGameSaveRepository repository, SnapshotValidator validator)
    {
        _repository = repository;
        _validator = validator;
    }

    public async Task<SnapshotValidationResult> Handle(ValidateSnapshotCommand request, CancellationToken cancellationToken)
    {
        var latest = await _repository.GetLatestAsync(request.UserId, cancellationToken);
        return _validator.Validate(request.Snapshot, latest?.Snapshot);
    }
}
