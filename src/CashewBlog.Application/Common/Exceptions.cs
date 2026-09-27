namespace CashewBlog.Application.Common;

/// <summary>Mapped to HTTP 404.</summary>
public sealed class NotFoundException(string message = "Not found.") : Exception(message);

/// <summary>Mapped to HTTP 400 with field errors (ValidationProblemDetails).</summary>
public sealed class ValidationException : Exception
{
    public ValidationException(IDictionary<string, string[]> errors)
        : base("One or more validation errors occurred.")
    {
        Errors = new Dictionary<string, string[]>(errors);
    }

    public ValidationException(string field, string error)
        : this(new Dictionary<string, string[]> { [field] = [error] })
    {
    }

    public IReadOnlyDictionary<string, string[]> Errors { get; }
}

/// <summary>Mapped to HTTP 409. <see cref="Payload"/> is serialized into the problem response.</summary>
public sealed class ConflictException(string error, string message, object? payload = null) : Exception(message)
{
    /// <summary>Machine-readable error code, e.g. <c>media_in_use</c>.</summary>
    public string Error { get; } = error;
    public object? Payload { get; } = payload;
}

/// <summary>Accumulates field errors and throws a single <see cref="ValidationException"/>.</summary>
public sealed class ValidationErrors
{
    private readonly Dictionary<string, List<string>> _errors = new();

    public bool HasErrors => _errors.Count > 0;

    public ValidationErrors Add(string field, string message)
    {
        if (!_errors.TryGetValue(field, out var list))
        {
            _errors[field] = list = [];
        }

        list.Add(message);
        return this;
    }

    public ValidationErrors Require(bool condition, string field, string message)
    {
        if (!condition)
        {
            Add(field, message);
        }

        return this;
    }

    public void ThrowIfAny()
    {
        if (HasErrors)
        {
            throw new ValidationException(_errors.ToDictionary(e => e.Key, e => e.Value.ToArray()));
        }
    }
}

/// <summary>Thrown when a database-backed service is used before first-run setup completed (HTTP 503).</summary>
public sealed class SetupRequiredException() : Exception("CashewBlog has not been set up yet.");
