#!/usr/bin/env bash
set -euo pipefail

target="${1:-}"
if [[ -z "$target" ]]; then
  echo "Usage: $0 <cloned-template-directory>" >&2
  exit 2
fi

target="$(cd "$target" && pwd)"
[[ "$target" != "/" && "$target" != "$HOME" ]] || {
  echo "Refusing to detach a broad directory: $target" >&2
  exit 1
}
[[ -f "$target/template.config.json" ]] || {
  echo "Not a validated template directory: $target" >&2
  exit 1
}

template_id="$(sed -n 's/.*"templateId"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "$target/template.config.json" | head -1)"
[[ "$template_id" == manzhushaka-agent-template-lite ]] || {
  echo "Unexpected templateId: $template_id" >&2
  exit 1
}

rm -rf "$target/.git"
git -C "$target" init -b main >/dev/null
git -C "$target" add -A
git -C "$target" -c user.name="manzhushaka-agent-template-builder" -c user.email="local@invalid" commit -m "chore: initialize independent agent demo" >/dev/null
echo "Detached template and initialized an independent repository: $target"
