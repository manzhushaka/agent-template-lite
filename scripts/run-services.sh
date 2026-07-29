#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
exec pnpm exec dotenv -e .env -- concurrently --kill-others-on-fail --names chat,console,agentos --prefix-colors cyan,magenta,yellow \
  "pnpm --filter @template/chat start" \
  "pnpm --filter @template/console start" \
  'cd services/agentos && uv run uvicorn app.main:app --host "${AGENTOS_HOST:-127.0.0.1}" --port "${AGENTOS_PORT:-8000}" --workers 1'
