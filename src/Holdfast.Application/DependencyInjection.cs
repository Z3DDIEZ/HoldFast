namespace Holdfast.Application;

using Holdfast.Domain.Validation;
using MediatR;
using Microsoft.Extensions.DependencyInjection;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(typeof(DependencyInjection).Assembly);
        services.AddSingleton<SnapshotValidator>();
        return services;
    }
}
