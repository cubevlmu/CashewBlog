# syntax=docker/dockerfile:1.7
#
# CashewBlog application image: ASP.NET gateway/API + Astro SSR (Node) + built admin SPA.
# PostgreSQL is external and configured through the first-run /setup wizard.

ARG NODE_VERSION=24
ARG DOTNET_VERSION=10.0

# ---- 1. Frontends (public Astro site + Vue admin) -------------------------------
FROM node:${NODE_VERSION}-bookworm-slim AS frontend
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo
# PrimeUI license key for the admin SPA (PrimeVue 5). Pass it with
#   docker build --build-arg VITE_PRIMEUI_LICENSE=... .
# CI supplies this with the PRIMEUI_LICENSE repository secret. Local builds may use
# apps/admin/.env.local (which is excluded from git).
ARG VITE_PRIMEUI_LICENSE
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/admin/package.json apps/admin/package.json
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY apps apps
RUN export VITE_PRIMEUI_LICENSE=$VITE_PRIMEUI_LICENSE \
 && pnpm --filter @cashewblog/web build \
 && pnpm --filter @cashewblog/admin build \
 && pnpm --filter @cashewblog/web deploy --prod --legacy /out/web \
 && cp -r apps/web/dist /out/web/dist \
 && node -p "require('./apps/web/node_modules/astro/package.json').version" > /out/astro-version

# ---- 2. ASP.NET API ---------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:${DOTNET_VERSION} AS api
WORKDIR /repo
COPY Directory.Build.props Directory.Packages.props CashewBlog.slnx ./
COPY src src
COPY apps/shared apps/shared
# global.json (local SDK pin) is intentionally not copied: the image ships its own SDK.
RUN dotnet publish src/CashewBlog.Api/CashewBlog.Api.csproj -c Release -o /out/api /p:UseAppHost=false

# ---- 3. Runtime ---------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:${DOTNET_VERSION} AS runtime
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini curl \
 && rm -rf /var/lib/apt/lists/*
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node

WORKDIR /app
COPY --from=api /out/api ./api
COPY --from=frontend /repo/apps/admin/dist ./api/wwwroot/admin
COPY --from=frontend /out/web ./web
COPY --from=frontend /out/astro-version ./astro-version
COPY docker/entrypoint.sh /usr/local/bin/cashewblog-entrypoint
RUN chmod +x /usr/local/bin/cashewblog-entrypoint \
 && mkdir -p /data /uploads

ENV ASPNETCORE_URLS=http://+:8080 \
    CASHEWBLOG_DATA_DIR=/data \
    CASHEWBLOG_UPLOADS_DIR=/uploads \
    CASHEWBLOG_WEB_UPSTREAM=http://127.0.0.1:4321 \
    CASHEWBLOG_API_URL=http://127.0.0.1:8080 \
    NODE_ENV=production

VOLUME ["/data", "/uploads"]
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/health/live || exit 1

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/cashewblog-entrypoint"]
