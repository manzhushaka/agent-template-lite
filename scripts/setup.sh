#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

for command_name in node pnpm uv; do
  command -v "$command_name" >/dev/null 2>&1 || { echo "$command_name is required" >&2; exit 1; }
done

node_major=$(node -p 'process.versions.node.split(".")[0]')
(( node_major >= 20 )) || { echo "Node.js 20 or newer is required" >&2; exit 1; }

if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "Created .env. Configure MySQL, secrets and the real MODEL_API_KEY before starting."
fi

pnpm install
(cd services/agentos && uv sync)

echo "Dependencies installed. Next steps: pnpm db:migrate && pnpm db:seed && pnpm dev"
