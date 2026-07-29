#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_ROOT/var/logs/app.pid"
cd "$PROJECT_ROOT"

pid_is_running() {
  local pid="${1:-}"
  local state
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  kill -0 "$pid" 2>/dev/null || return 1
  state="$(ps -o stat= -p "$pid" 2>/dev/null | tr -d '[:space:]')"
  [[ -n "$state" && "$state" != Z* ]]
}

pid=""
if [[ -f "$PID_FILE" ]]; then
  pid="$(tr -d '[:space:]' < "$PID_FILE")"
fi
if ! pid_is_running "$pid"; then
  rm -f "$PID_FILE"
  echo "agent-template-lite is stopped"
  exit 1
fi
echo "agent-template-lite supervisor is running (PID $pid)"

if [[ -f .env ]]; then
  ports="$(pnpm exec dotenv -e .env -- bash -c 'printf "%s %s %s" "${CHAT_PORT:-3000}" "${CONSOLE_PORT:-3001}" "${AGENTOS_PORT:-8000}"')"
else
  ports="3000 3001 8000"
fi
IFS=' ' read -r chat_port console_port agentos_port <<< "$ports"

unhealthy=0
for endpoint in "http://127.0.0.1:${chat_port}" "http://127.0.0.1:${console_port}/api/health" "http://127.0.0.1:${agentos_port}/api/health"; do
  status=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 3 "$endpoint" || true)
  printf '%s %s\n' "$status" "$endpoint"
  [[ "$status" == "200" ]] || unhealthy=1
done
exit "$unhealthy"
