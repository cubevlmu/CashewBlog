using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CashewBlog.Api.Hosting;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Admin;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;

namespace CashewBlog.Api.Endpoints;

public static class AdminAuthEndpoints
{
    public const string AuthCookieName = "cashewblog_auth";
    public const string LoginRateLimitPolicy = "login";
    public const string PasswordStampClaim = "cashewblog:pwd";

    /// <summary>Anonymous auth endpoints; they live in the CSRF-protected /api/admin group.</summary>
    public static void MapAdminAuthEndpoints(this RouteGroupBuilder admin)
    {
        admin.MapGet("/csrf", (HttpContext context, IAntiforgery antiforgery) =>
        {
            var token = Csrf.Issue(context, antiforgery);
            return Results.Ok(new { token, headerName = Csrf.HeaderName });
        }).AllowAnonymous();

        admin.MapGet("/session", async (HttpContext context, IAntiforgery antiforgery) =>
        {
            Csrf.Issue(context, antiforgery);
            var result = await context.AuthenticateAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            return Results.Ok(result.Succeeded
                ? new SessionDto(true, "admin", result.Properties?.ExpiresUtc)
                : new SessionDto(false, null, null));
        }).AllowAnonymous();

        admin.MapPost("/login", async (LoginRequest request, HttpContext context, AuthService auth, IConfigStore config,
            IAntiforgery antiforgery, ILogger<AuthService> logger) =>
        {
            if (!auth.VerifyPassword(request.Password))
            {
                logger.LogWarning("Failed admin login from {Ip}", context.Connection.RemoteIpAddress);
                return ApiErrors.Problem(StatusCodes.Status401Unauthorized, "invalid_password", "Incorrect password.");
            }

            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, "admin"), new Claim(PasswordStampClaim, PasswordStamp(config))],
                CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);
            var properties = new AuthenticationProperties { IsPersistent = true, AllowRefresh = true };
            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, properties);

            // The antiforgery token is bound to the user; hand out one for the new identity.
            context.User = principal;
            Csrf.Issue(context, antiforgery);
            logger.LogInformation("Admin signed in from {Ip}", context.Connection.RemoteIpAddress);
            return Results.Ok(new SessionDto(true, "admin", properties.ExpiresUtc));
        }).AllowAnonymous().RequireRateLimiting(LoginRateLimitPolicy);

        admin.MapPost("/logout", async (HttpContext context, IAntiforgery antiforgery) =>
        {
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
            context.User = new ClaimsPrincipal(new ClaimsIdentity());
            Csrf.Issue(context, antiforgery);
            return Results.NoContent();
        }).AllowAnonymous();
    }

    public static void MapAdminAccountEndpoints(this RouteGroupBuilder secured)
    {
        secured.MapPost("/password", async (ChangePasswordRequest request, HttpContext context, AuthService auth, IConfigStore config,
            IAntiforgery antiforgery, CancellationToken ct) =>
        {
            await auth.ChangePasswordAsync(request, ct);

            // Other sessions are invalidated by the password stamp; re-issue this one.
            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, "admin"), new Claim(PasswordStampClaim, PasswordStamp(config))],
                CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);
            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal,
                new AuthenticationProperties { IsPersistent = true, AllowRefresh = true });
            context.User = principal;
            Csrf.Issue(context, antiforgery);
            return Results.NoContent();
        });
    }

    /// <summary>Short fingerprint of the current password hash; sessions issued before a password change become invalid.</summary>
    public static string PasswordStamp(IConfigStore config) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(config.Current?.Admin.PasswordHash ?? "")))[..16];
}
