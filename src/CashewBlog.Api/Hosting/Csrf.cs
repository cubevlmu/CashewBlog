using Microsoft.AspNetCore.Antiforgery;

namespace CashewBlog.Api.Hosting;

/// <summary>
/// Double-submit CSRF protection for cookie-authenticated admin writes:
/// the server stores an HttpOnly antiforgery cookie and exposes the matching request token in
/// the JS-readable <c>XSRF-TOKEN</c> cookie; clients echo it in the <c>X-XSRF-TOKEN</c> header.
/// </summary>
public static class Csrf
{
    public const string HeaderName = "X-XSRF-TOKEN";
    public const string CookieName = "cashewblog_af";
    public const string ReadableCookieName = "XSRF-TOKEN";

    /// <summary>
    /// Issues a fresh token pair for the current <see cref="HttpContext.User"/>. Tokens are bound to
    /// the user identity, so call this again after sign-in/sign-out.
    /// </summary>
    public static string Issue(HttpContext context, IAntiforgery antiforgery)
    {
        var tokens = antiforgery.GetAndStoreTokens(context);
        context.Response.Cookies.Append(ReadableCookieName, tokens.RequestToken!, new CookieOptions
        {
            HttpOnly = false,
            SameSite = SameSiteMode.Strict,
            Secure = context.Request.IsHttps,
            Path = "/",
            IsEssential = true,
        });
        return tokens.RequestToken!;
    }
}

/// <summary>Validates the CSRF header on every state-changing request of the endpoint group.</summary>
public sealed class CsrfFilter(IAntiforgery antiforgery) : IEndpointFilter
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var method = context.HttpContext.Request.Method;
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) || HttpMethods.IsOptions(method))
        {
            return await next(context);
        }

        try
        {
            await antiforgery.ValidateRequestAsync(context.HttpContext);
        }
        catch (AntiforgeryValidationException)
        {
            return ApiErrors.Problem(StatusCodes.Status400BadRequest, "csrf_invalid",
                "Missing or invalid CSRF token. Send the XSRF-TOKEN cookie value in the X-XSRF-TOKEN header.");
        }

        return await next(context);
    }
}
