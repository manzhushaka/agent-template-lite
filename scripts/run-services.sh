#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
export APP_LOG_FILE="${APP_LOG_FILE:-$PROJECT_ROOT/var/logs/app.log}"
exec pnpm exec dotenv -e .env -- concurrently --kill-others-on-fail --no-color \
  --names chat,console,agentos \
  --prefix "[{time} {name}]" \
  --timestamp-format "yyyy-MM-dd HH:mm:ss.SSS" \
  "pnpm --filter @template/chat start" \
  "pnpm --filter @template/console start" \
  'cd services/agentos && uv run uvicorn app.main:app --host "${AGENTOS_HOST:-127.0.0.1}" --port "${AGENTOS_PORT:-8000}" --workers 1'
