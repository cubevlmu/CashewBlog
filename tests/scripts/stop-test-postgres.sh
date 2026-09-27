#!/usr/bin/env bash
# Stops the disposable PostgreSQL test cluster. Pass --purge to delete its files.
set -euo pipefail

PG_TEST_DIR="${PG_TEST_DIR:-${TMPDIR:-/tmp}/cashewblog-test-pg}"
if [[ -z "${PG_BIN:-}" ]]; then
  if [[ -x "/c/Apps/PGSQLServer/bin/pg_ctl.exe" ]]; then
    PG_BIN="/c/Apps/PGSQLServer/bin"
  else
    PG_BIN="$(dirname "$(command -v pg_ctl)")"
  fi
fi

"$PG_BIN/pg_ctl" -D "$PG_TEST_DIR/data" -m fast stop || true

if [[ "${1:-}" == "--purge" ]]; then
  rm -rf "$PG_TEST_DIR"
  echo "Removed $PG_TEST_DIR"
fi
