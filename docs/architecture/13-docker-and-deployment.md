# Docker and Deployment

## Target topology

One CashewBlog application image contains:

- ASP.NET Core API/runtime
- Astro SSR Node runtime/build
- built Vue admin assets

PostgreSQL is external and configured on first setup.

External URL space is same-origin:

```text
/                   public Astro
/posts/*
/archive
...
/admin/*            Vue admin
/api/*              ASP.NET REST
/uploads/*          media
/setup               first-run UI
```

No separate API hostname and no CORS requirement for normal deployment.

## Recommended runtime process model

A container has more than one application runtime (ASP.NET + Astro Node). Use an explicit supervisor/entrypoint strategy with correct signal forwarding.

Possible topology:

```text
container :8080
   |
   +-- ASP.NET gateway/API
          |
          +-- /api, /admin assets, /uploads
          +-- proxy public SSR requests -> Astro on localhost:4321

Astro Node localhost:4321
```

This gives one externally exposed process/port and centralizes cookies/setup gating.

A lightweight reverse proxy inside the image is another option, but avoid adding nginx merely by habit if ASP.NET proxying is sufficient and robust.

## Persistent mounts

```text
/data       config, ASP.NET data-protection keys, runtime state
/uploads    originals, optimized images, thumbnails, attachments
```

Database is not stored in the application container.

## Multi-stage Docker build

Suggested stages:

1. Node/pnpm build public `apps/web`.
2. Node/pnpm build `apps/admin`.
3. .NET SDK restore/build/publish.
4. final runtime image with .NET runtime + Node runtime + required native image-processing libraries.

The admin build needs the PrimeUI license key (PrimeVue 5): pass it as
`docker build --build-arg VITE_PRIMEUI_LICENSE=...`; a local `apps/admin/.env.local` is used when the
argument is omitted.

Copy only production dependencies/build output into final stage.

## Health

Expose at minimum:

- liveness: process running
- readiness: initialized + database reachable + Astro child healthy

Before setup is complete, readiness semantics may report setup-required rather than unhealthy depending on orchestration needs.

## Example operator compose

The repository may provide a sample PostgreSQL compose for convenience, but CashewBlog must not assume PG is colocated:

```yaml
services:
  cashewblog:
    image: cashewblog:latest
    ports: ["8080:8080"]
    volumes:
      - ./data:/data
      - ./uploads:/uploads
```

The setup wizard receives the real PostgreSQL host credentials.
