#!/usr/bin/env bash
# Runs the two application processes of the CashewBlog image:
#   - Astro SSR (Node) on 127.0.0.1:4321, reachable only through the gateway
#   - ASP.NET gateway/API on :8080, the single public port
# tini (PID 1) forwards signals here; SIGTERM/SIGINT stop both processes, and if
# either one exits the other is stopped so the container restarts as a unit.
set -euo pipefail

export CASHEWBLOG_NODE_VERSION="$(node --version)"
export CASHEWBLOG_ASTRO_VERSION="$(cat /app/astro-version 2>/dev/null || true)"

HOST=127.0.0.1 PORT=4321 node /app/web/dist/server/entry.mjs &
web_pid=$!

cd /app/api
dotnet CashewBlog.Api.dll &
api_pid=$!

shutdown() {
	kill -TERM "$api_pid" "$web_pid" 2>/dev/null || true
	wait "$api_pid" "$web_pid" 2>/dev/null || true
}
trap shutdown TERM INT

# Exit as soon as either process stops.
set +e
wait -n "$api_pid" "$web_pid"
status=$?
set -e
shutdown
exit "$status"
