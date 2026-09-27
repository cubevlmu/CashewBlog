using System.Text.Json;
using CashewBlog.Application.Common;
using CashewBlog.Domain;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace CashewBlog.Api.Hosting;

/// <summary>Uniform error bodies: RFC 7807 problem details with a machine-readable <c>error</c> code.</summary>
public static class ApiErrors
{
    public static IResult Problem(int status, string error, string title, IDictionary<string, object?>? extra = null)
    {
        var extensions = new Dictionary<string, object?> { ["error"] = error };
        if (extra is not null)
        {
            foreach (var (key, value) in extra)
            {
                extensions[key] = value;
            }
        }

        return Results.Problem(statusCode: status, title: title, extensions: extensions);
    }

    public static IResult NotFound(string title = "Not found.") => Problem(StatusCodes.Status404NotFound, "not_found", title);

    /// <summary>Writes a problem JSON body directly (for middleware/cookie events outside endpoints).</summary>
    public static Task WriteAsync(HttpContext context, int status, string error, string title)
    {
        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        var body = new Dictionary<string, object?>
        {
            ["type"] = $"https://httpstatuses.io/{status}",
            ["title"] = title,
            ["status"] = status,
            ["error"] = error,
        };
        return context.Response.WriteAsync(JsonSerializer.Serialize(body, AppJson.Options));
    }
}

/// <summary>Maps application exceptions to HTTP responses.</summary>
public sealed class ApiExceptionHandler(IProblemDetailsService problemDetails, ILogger<ApiExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        ProblemDetails? problem = exception switch
        {
            ValidationException ex => new ValidationProblemDetails(ex.Errors.ToDictionary(e => e.Key, e => e.Value))
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred.",
                Extensions = { ["error"] = "validation_failed" },
            },
            NotFoundException ex => Build(StatusCodes.Status404NotFound, "not_found", ex.Message),
            ConflictException ex => BuildConflict(ex),
            DomainException ex => Build(StatusCodes.Status409Conflict, "invalid_state", ex.Message),
            SetupRequiredException ex => Build(StatusCodes.Status503ServiceUnavailable, "setup_required", ex.Message),
            BadHttpRequestException ex => Build(ex.StatusCode, ex.StatusCode == 413 ? "payload_too_large" : "bad_request", ex.Message),
            JsonException ex => Build(StatusCodes.Status400BadRequest, "bad_request", ex.Message),
            _ => null,
        };

        if (problem is null)
        {
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
            return false;
        }

        httpContext.Response.StatusCode = problem.Status ?? 500;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }

    private static ProblemDetails Build(int status, string error, string title) => new()
    {
        Status = status,
        Title = title,
        Extensions = { ["error"] = error },
    };

    private static ProblemDetails BuildConflict(ConflictException ex)
    {
        var problem = Build(StatusCodes.Status409Conflict, ex.Error, ex.Message);
        if (ex.Payload is not null)
        {
            var payload = JsonSerializer.SerializeToElement(ex.Payload, AppJson.Options);
            foreach (var property in payload.EnumerateObject())
            {
                problem.Extensions[property.Name] = property.Value;
            }
        }

        return problem;
    }
}
