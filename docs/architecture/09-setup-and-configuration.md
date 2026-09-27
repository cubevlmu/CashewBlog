# Setup and Configuration

## Runtime config file

Persist operator/bootstrap configuration under the mounted data volume, e.g. `/data/config.json`.

It contains infrastructure-level settings only:

```json
{
  "ConfigVersion": 1,
  "Admin": {
    "PasswordHash": "<Argon2id hash>"
  },
  "Database": {
    "Host": "db.example",
    "Port": 5432,
    "Database": "cashewblog",
    "Username": "cashewblog",
    "Password": "...",
    "SslMode": "Prefer"
  },
  "Storage": {
    "Root": "/uploads",
    "MaxUploadBytes": 104857600
  }
}
```

Do not store the admin password in plaintext.

Site title/profile/theme/navigation/etc. belong in PostgreSQL `SiteSettings`, not this file.

## First-run state

On application start:

1. If config does not exist or is incomplete, mark runtime `SetupRequired`.
2. Only `/setup`, setup API, health/static assets needed by setup are available.
3. User enters setup values.
4. Backend tests PostgreSQL connectivity.
5. Target database must already exist.
6. Run EF Core migrations.
7. Hash admin password with Argon2id.
8. Write config atomically (temporary file + rename).
9. Seed singleton `SiteSettings` and initial site identity.
10. Mark setup complete and redirect to `/admin`.

After successful initialization, setup endpoints should return 404/403 and `/setup` should not expose reinitialization.

## Editing DB connection later

There is no admin UI for DB connection settings.

An operator may stop the service and edit `/data/config.json` manually. Validate configuration at startup and fail with a clear operator-facing error if it is invalid.

## Automatic migrations

For an initialized deployment, application startup checks EF schema and automatically applies bundled migrations before serving traffic.

Recommended safeguards:

- acquire a PostgreSQL advisory lock or equivalent migration lock so multiple instances do not migrate concurrently
- log migration IDs
- stop startup if migration fails
- never silently reset/drop data

## Settings bootstrap

After first setup, admin may be shown a one-time lightweight prompt linking to Settings for profile/banner/theme completion. Do not build a second mandatory wizard.
