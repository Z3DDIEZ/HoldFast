namespace Holdfast.Application.Saves;

using Holdfast.Domain.Snapshots;
using MediatR;

public sealed class LoadGameQueryHandler : IRequestHandler<LoadGameQuery, GameState?>
{
    private readonly IGameSaveRepository _repository;

    public LoadGameQueryHandler(IGameSaveRepository repository)
    {
        _repository = repository;
    }

    public async Task<GameState?> Handle(LoadGameQuery request, CancellationToken cancellationToken)
    {
        var latest = await _repository.GetLatestAsync(request.UserId, cancellationToken);
        return latest?.Snapshot;
    }
}
