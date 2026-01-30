#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is not set. Source .env.local.example and set DATABASE_URL."
  exit 1
fi

psql "$DATABASE_URL" -f "$(dirname "$0")/seed-local.sql"
