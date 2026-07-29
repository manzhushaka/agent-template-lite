#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"
[[ -f .env ]] || { echo "Missing .env. Run ./scripts/setup.sh first." >&2; exit 1; }
mkdir -p var/logs
PID_FILE="$PROJECT_ROOT/var/logs/app.pid"
LOG_FILE="$PROJECT_ROOT/var/logs/app.log"

# `kill -0` also succeeds for zombie processes on some systems. Checking the process state keeps a
# crashed supervisor from being reported as healthy forever.
pid_is_running() {
  local pid="${1:-}"
  local state
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  state="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$state" && "$state" != Z* ]]
}

existing_pid=""
if [[ -f "$PID_FILE" ]]; then
  existing_pid="$(tr -d '[:space:]' < "$PID_FILE")"
fi
if pid_is_running "$existing_pid"; then
  echo "agent-template-lite is already running (PID $existing_pid)."
  exit 0
fi
rm -f "$PID_FILE"

# Fail before daemonizing. This is intentionally limited to presence checks: secrets are never
# echoed, while Python's Settings class remains the source of truth for detailed validation.
pnpm exec dotenv -e .env -- bash -c '
  missing=()
  for name in MYSQL_URL AGENT_DATABASE_URL AUTH_SECRET INTERNAL_API_TOKEN MODEL_NAME MODEL_BASE_URL MODEL_API_KEY; do
    [[ -n "${!name:-}" ]] || missing+=("$name")
  done
  if (( ${#missing[@]} > 0 )); then
    printf "Missing required .env values: %s\n" "${missing[*]}" >&2
    exit 1
  fi
'
(cd services/agentos && uv run python -c 'from app.config import Settings; Settings.from_env()')

if [[ ! -f apps/chat/.next/BUILD_ID || ! -f apps/console/.next/BUILD_ID ]]; then
  pnpm build
fi

: > "$LOG_FILE"
nohup "$PROJECT_ROOT/scripts/run-services.sh" > "$LOG_FILE" 2>&1 < /dev/null &
supervisor_pid=$!
echo "$supervisor_pid" > "$PID_FILE"

# Read ports only after dotenv has populated the child shell. This also makes custom ports in
# `.env` work without requiring callers to export them in their terminal first.
ports="$(pnpm exec dotenv -e .env -- bash -c 'printf "%s %s %s" "${CHAT_PORT:-3000}" "${CONSOLE_PORT:-3001}" "${AGENTOS_PORT:-8000}"')"
IFS=' ' read -r chat_port console_port agentos_port <<< "$ports"
endpoints=(
  "http://127.0.0.1:${chat_port}"
  "http://127.0.0.1:${console_port}/api/health"
  "http://127.0.0.1:${agentos_port}/api/health"
)

# AgentOS imports the model, storage and vector configuration before Uvicorn starts. Give that
# initialization time to finish so a successful return from this script means all services answer.
for _attempt in {1..45}; do
  if ! pid_is_running "$supervisor_pid"; then
    rm -f "$PID_FILE"
    echo "Services failed during startup. Last log lines:" >&2
    tail -n 40 "$LOG_FILE" >&2
    exit 1
  fi

  healthy=true
  for endpoint in "${endpoints[@]}"; do
    status="$(curl -sS -o /dev/null -w "%{http_code}" --max-time 2 "$endpoint" || true)"
    [[ "$status" == "200" ]] || healthy=false
  done
  if [[ "$healthy" == true ]]; then
    echo "Started services (PID $supervisor_pid). Logs: tail -f $LOG_FILE"
    printf '200 %s\n' "${endpoints[@]}"
    exit 0
  fi
  sleep 1
done

kill "$supervisor_pid" 2>/dev/null || true
rm -f "$PID_FILE"
echo "Services did not become healthy within 45 seconds. Last log lines:" >&2
tail -n 40 "$LOG_FILE" >&2
exit 1
