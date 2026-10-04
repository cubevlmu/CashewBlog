using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using CashewBlog.Api.Hosting;
using CashewBlog.Application.Abstractions;
using CashewBlog.Application.Admin;
using CashewBlog.Infrastructure.Security;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Mvc;

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

        // Both login endpoints answer 404 unless the browser came through the login entrance.
        admin.MapGet("/login/options", (HttpContext context, AdminEntrance entrance, AuthService auth) =>
            entrance.IsValid(context)
                ? Results.Ok(new LoginOptionsDto(auth.Turnstile.Enabled ? auth.Turnstile.SiteKey : null))
                : ApiErrors.NotFound()).AllowAnonymous();

        admin.MapPost("/login", async (LoginRequest request, HttpContext context, AuthService auth, IConfigStore config,
            AdminEntrance entrance, LoginThrottle throttle, ISecurityAlertRecorder alerts, IAntiforgery antiforgery, ILogger<AuthService> logger, CancellationToken ct) =>
        {
            if (!entrance.IsValid(context))
            {
                return ApiErrors.NotFound();
            }

            var ip = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
            if (throttle.LockedFor(ip) is { } locked)
            {
                await alerts.RecordAsync("LoginBruteForce", "Critical", ip, context.Request.Path,
                    "被锁定的来源继续尝试登录。", ct);
                return Locked(context, locked);
            }

            if (!await auth.VerifyTurnstileAsync(request.TurnstileToken, ip, ct))
            {
                logger.LogWarning("Admin login from {Ip} failed the Turnstile check", ip);
                return ApiErrors.Problem(StatusCodes.Status400BadRequest, "turnstile_failed", "Human verification failed. Complete the challenge again.");
            }

            // Argon2 costs ~19 MiB and tens of milliseconds; a small gate keeps floods from exhausting the host.
            if (!await PasswordGate.WaitAsync(TimeSpan.FromSeconds(10), ct))
            {
                return ApiErrors.Problem(StatusCodes.Status429TooManyRequests, "rate_limited", "The server is busy. Try again shortly.");
            }

            bool valid;
            try
            {
                valid = auth.VerifyPassword(request.Password);
            }
            finally
            {
                PasswordGate.Release();
            }

            if (!valid)
            {
                var lockout = throttle.RecordFailure(ip);
                logger.LogWarning("Failed admin login from {Ip}", ip);
                // Uniform, slightly randomized latency blunts timing and scripted guessing.
                await Task.Delay(Random.Shared.Next(200, 400), ct);
                if (lockout is { } started)
                {
                    await alerts.RecordAsync("LoginBruteForce", "Critical", ip, context.Request.Path,
                        "登录失败次数达到锁定阈值。", ct);
                    logger.LogWarning("Admin login locked for {Ip} for {Minutes} minutes after repeated failures", ip, (int)started.TotalMinutes);
                    return Locked(context, started);
                }

                return ApiErrors.Problem(StatusCodes.Status401Unauthorized, "invalid_password", "Incorrect password.");
            }

            throttle.Reset(ip);
            var identity = new ClaimsIdentity(
                [new Claim(ClaimTypes.Name, "admin"), new Claim(PasswordStampClaim, PasswordStamp(config))],
                CookieAuthenticationDefaults.AuthenticationScheme);
            var principal = new ClaimsPrincipal(identity);
            var properties = new AuthenticationProperties { IsPersistent = true, AllowRefresh = true };
            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal, properties);

            // The antiforgery token is bound to the user; hand out one for the new identity.
            context.User = principal;
            Csrf.Issue(context, antiforgery);
            logger.LogInformation("Admin signed in from {Ip}", ip);
            return Results.Ok(new SessionDto(true, "admin", properties.ExpiresUtc));
        }).AllowAnonymous().RequireRateLimiting(LoginRateLimitPolicy).WithMetadata(new RequestSizeLimitAttribute(16 * 1024));

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

        secured.MapGet("/security", (AuthService auth) => auth.GetSecuritySettings());

        secured.MapPut("/security", (UpdateSecuritySettingsRequest request, HttpContext context, AuthService auth, CancellationToken ct) =>
            auth.UpdateSecuritySettingsAsync(request, context.Connection.RemoteIpAddress?.ToString(), ct));
    }

    private static readonly SemaphoreSlim PasswordGate = new(2, 2);

    private static IResult Locked(HttpContext context, TimeSpan remaining)
    {
        var seconds = (int)Math.Ceiling(remaining.TotalSeconds);
        context.Response.Headers.RetryAfter = seconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
        return ApiErrors.Problem(StatusCodes.Status429TooManyRequests, "login_locked",
            "Too many failed sign-in attempts from this address. Try again later.",
            new Dictionary<string, object?> { ["retryAfterSeconds"] = seconds });
    }

    /// <summary>Short fingerprint of the current password hash; sessions issued before a password change become invalid.</summary>
    public static string PasswordStamp(IConfigStore config) =>
        Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(config.Current?.Admin.PasswordHash ?? "")))[..16];
}
