namespace Holdfast.Api.Controllers;

using Holdfast.Api.Contracts;
using Holdfast.Application.Saves;
using Holdfast.Domain.Snapshots;
using MediatR;
using Microsoft.AspNetCore.Mvc;

[ApiController]
[Route("api/saves")]
public sealed class SavesController : ControllerBase
{
    private readonly IMediator _mediator;

    public SavesController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost]
    [ProducesResponseType(typeof(SaveGameResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(SnapshotValidationResponse), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Save(
        [FromBody] GameState snapshot,
        [FromHeader(Name = "X-User-Id")] string? userId,
        CancellationToken cancellationToken)
    {
        var resolvedUserId = ResolveUserId(userId);
        var result = await _mediator.Send(new SaveGameCommand(resolvedUserId, snapshot), cancellationToken);

        if (!result.IsValid)
        {
            return UnprocessableEntity(new SnapshotValidationResponse(false, result.Violations));
        }

        return StatusCode(
            StatusCodes.Status201Created,
            new SaveGameResponse(result.SaveId!.Value, result.SavedAt!.Value));
    }

    [HttpGet("{userId}/latest")]
    [ProducesResponseType(typeof(GameState), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<GameState>> GetLatest(string userId, CancellationToken cancellationToken)
    {
        var snapshot = await _mediator.Send(new LoadGameQuery(userId), cancellationToken);
        if (snapshot is null)
        {
            return NotFound();
        }

        return Ok(snapshot);
    }

    private static string ResolveUserId(string? userId)
    {
        return string.IsNullOrWhiteSpace(userId) ? "local" : userId.Trim();
    }
}
