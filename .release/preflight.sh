#!/usr/bin/env bash
set -euo pipefail

release_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd "${release_dir}/.." && pwd)
source "${release_dir}/project.env"

mode=${1:-local}
shift || true
artifact=""
ssh_config=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --artifact) artifact=$2; shift 2 ;;
    --ssh-config) ssh_config=$2; shift 2 ;;
    --release-id) shift 2 ;;
    *) echo "Unknown preflight argument: $1" >&2; exit 1 ;;
  esac
done

case "${mode}" in
  local)
    command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
    command -v pnpm >/dev/null || { echo "pnpm is required" >&2; exit 1; }
    command -v uv >/dev/null || { echo "uv is required" >&2; exit 1; }
    [[ ${RUNTIME_VERSION} == 22 ]] || { echo "Unexpected Node runtime version" >&2; exit 1; }
    for path in package.json pnpm-lock.yaml pnpm-workspace.yaml apps/chat/package.json apps/console/package.json \
      apps/console/tsconfig.json packages/shared/package.json deploy/agent-template-deploy \
      deploy/agent-template.locations.conf services/agentos/pyproject.toml services/agentos/uv.lock; do
      [[ -e "${project_dir}/${path}" ]] || { echo "Missing release input: ${path}" >&2; exit 1; }
    done
    ;;
  remote)
    [[ -n ${ssh_config} && -f ${ssh_config} ]] || { echo "--ssh-config is required" >&2; exit 1; }
    ssh -F "${ssh_config}" release-home "sudo /usr/local/sbin/agent-template-deploy --preflight"
    ;;
  *) echo "Unsupported preflight mode: ${mode}" >&2; exit 1 ;;
esac

if [[ -n ${artifact} ]]; then
  [[ -f ${artifact} ]] || { echo "Artifact is missing: ${artifact}" >&2; exit 1; }
  (cd "$(dirname "${artifact}")" && sha256sum -c "$(basename "${artifact}").sha256")
  tar -tzf "${artifact}" | awk '
    /^\// || /(^|\/)\.\.\// || /(^|\/)(\.env|.*\.pem|.*\.key)$/ { bad=1; print "Forbidden artifact path: " $0 > "/dev/stderr" }
    END { exit bad ? 1 : 0 }
  '
  if tar -tvzf "${artifact}" | awk '$1 ~ /^[lh]/ { found=1 } END { exit found ? 0 : 1 }'; then
    echo "Artifact contains symbolic or hard links" >&2
    exit 1
  fi
  echo "Artifact preflight passed: ${artifact}"
fi
