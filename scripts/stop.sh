#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="$PROJECT_ROOT/var/logs/app.pid"
if [[ ! -f "$PID_FILE" ]]; then echo "agent-template-lite is already stopped"; exit 0; fi
pid="$(tr -d '[:space:]' < "$PID_FILE")"
if [[ "$pid" =~ ^[0-9]+$ ]] && kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  # Concurrently forwards SIGTERM to all three services. Wait briefly so a subsequent start does
  # not race against ports that are still being released.
  for _attempt in {1..10}; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
fi
rm -f "$PID_FILE"
echo "Stopped agent-template-lite"
