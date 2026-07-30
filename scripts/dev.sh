#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
[[ -f .env ]] || { echo "Missing .env. Run ./scripts/setup.sh first." >&2; exit 1; }

mkdir -p var/logs
LOG_FILE="$PROJECT_ROOT/var/logs/app.log"
export APP_LOG_FILE="$LOG_FILE"
: > "$LOG_FILE"

pnpm exec dotenv -e .env -- concurrently --kill-others-on-fail --no-color \
  --names chat,console,agentos \
  --prefix "[{time} {name}]" \
  --timestamp-format "yyyy-MM-dd HH:mm:ss.SSS" \
  "pnpm --filter @template/chat dev" \
  "pnpm --filter @template/console dev" \
  "cd services/agentos && uv run python -m app.main" 2>&1 | tee "$LOG_FILE"
