#!/usr/bin/env bash
# Starts a disposable PostgreSQL cluster for CashewBlog integration tests.
#
#   PG_BIN      directory containing initdb/pg_ctl (default: C:/Apps/PGSQLServer/bin or PATH)
#   PG_TEST_DIR cluster directory (default: $TMPDIR/cashewblog-test-pg)
#   PG_TEST_PORT port (default 55432)
#
# The cluster uses trust authentication for the `postgres` superuser and only
# listens on 127.0.0.1. It never touches any other PostgreSQL installation.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PG_TEST_DIR="${PG_TEST_DIR:-${TMPDIR:-/tmp}/cashewblog-test-pg}"
PG_TEST_PORT="${PG_TEST_PORT:-55432}"

if [[ -z "${PG_BIN:-}" ]]; then
  if [[ -x "/c/Apps/PGSQLServer/bin/pg_ctl.exe" ]]; then
    PG_BIN="/c/Apps/PGSQLServer/bin"
  else
    PG_BIN="$(dirname "$(command -v pg_ctl)")"
  fi
fi

INITDB="$PG_BIN/initdb"
PG_CTL="$PG_BIN/pg_ctl"
DATA_DIR="$PG_TEST_DIR/data"
LOG_FILE="$PG_TEST_DIR/postgres.log"

mkdir -p "$PG_TEST_DIR"

if [[ ! -f "$DATA_DIR/PG_VERSION" ]]; then
  echo "Initializing test cluster in $DATA_DIR"
  # builtin C.UTF-8 provider (PG17+) gives Unicode-aware character classes, which
  # pg_trgm needs to build trigrams for CJK text. Fall back for older servers.
  "$INITDB" -D "$DATA_DIR" -U postgres -A trust -E UTF8 --locale-provider=builtin --locale=C.UTF-8 >/dev/null \
    || "$INITDB" -D "$DATA_DIR" -U postgres -A trust -E UTF8 --locale=C >/dev/null
fi

if "$PG_CTL" -D "$DATA_DIR" status >/dev/null 2>&1; then
  echo "Test cluster already running on port $PG_TEST_PORT"
  exit 0
fi

# Redirect stdio so the postmaster does not inherit (and hold open) the caller's pipes.
"$PG_CTL" -D "$DATA_DIR" -o "-p $PG_TEST_PORT -c listen_addresses=127.0.0.1" -l "$LOG_FILE" -w start </dev/null >/dev/null 2>&1
echo "Test cluster running: Host=127.0.0.1;Port=$PG_TEST_PORT;Username=postgres"
