#!/usr/bin/env bash
set -euo pipefail

release_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd "${release_dir}/.." && pwd)
source "${release_dir}/project.env"
out_dir=${release_dir}/out
work_dir=${release_dir}/work
bundle_dir=${work_dir}/bundle

rm -rf "${out_dir}" "${work_dir}"
mkdir -p "${out_dir}" "${bundle_dir}/apps/chat" "${bundle_dir}/apps/console/scripts" \
  "${bundle_dir}/services/agentos" "${bundle_dir}/packages/shared" "${bundle_dir}/node_modules"
cd "${project_dir}"

pnpm install --frozen-lockfile
(cd services/agentos && uv sync --frozen)
export NODE_ENV=production
export CHAT_BASE_PATH=/gateway/agent-template/chat
export NEXT_PUBLIC_CHAT_BASE_PATH=/gateway/agent-template/chat
export CONSOLE_BASE_PATH=/gateway/agent-template/console
export NEXT_PUBLIC_CONSOLE_BASE_PATH=/gateway/agent-template/console
pnpm build

cp -RL apps/chat/.next/standalone/apps/chat/. "${bundle_dir}/apps/chat/"
cp -RL apps/console/.next/standalone/apps/console/. "${bundle_dir}/apps/console/"
cp -RL apps/chat/.next/standalone/node_modules/. "${bundle_dir}/node_modules/"
cp -RL apps/console/.next/standalone/node_modules/. "${bundle_dir}/node_modules/"
next_store=$(find node_modules/.pnpm -maxdepth 1 -type d -name 'next@*' | head -1)
[[ -n ${next_store} ]] || { echo "Next runtime package is missing" >&2; exit 1; }
cp -RL "${next_store}/node_modules/." "${bundle_dir}/apps/chat/node_modules/"
cp -RL "${next_store}/node_modules/." "${bundle_dir}/apps/console/node_modules/"
cp -RL apps/console/node_modules/tsx "${bundle_dir}/node_modules/tsx"
mkdir -p "${bundle_dir}/node_modules/tsx/node_modules/@esbuild"
tsx_store=$(find node_modules/.pnpm -maxdepth 1 -type d -name 'tsx@*' | head -1)
[[ -n ${tsx_store} && -f ${tsx_store}/node_modules/esbuild/package.json ]] || { echo "tsx runtime package is missing esbuild" >&2; exit 1; }
esbuild_package="${tsx_store}/node_modules/esbuild"
esbuild_version=$(node -p "require('./${esbuild_package}/package.json').version")
esbuild_platform="$(node -p "process.platform + '-' + process.arch")"
esbuild_store=$(find node_modules/.pnpm -maxdepth 1 -type d -name "esbuild@${esbuild_version}" | head -1)
native_esbuild_store=$(find node_modules/.pnpm -maxdepth 1 -type d -name "@esbuild+${esbuild_platform}@${esbuild_version}" | head -1)
[[ -n ${esbuild_store} && -d ${esbuild_store}/node_modules/esbuild ]] || { echo "esbuild runtime package is missing" >&2; exit 1; }
[[ -n ${native_esbuild_store} && -d ${native_esbuild_store}/node_modules/@esbuild/${esbuild_platform} ]] || {
  echo "esbuild native package is missing for ${esbuild_platform}" >&2
  exit 1
}
cp -RL "${esbuild_package}" "${bundle_dir}/node_modules/tsx/node_modules/esbuild"
cp -RL "${native_esbuild_store}/node_modules/@esbuild/${esbuild_platform}" \
  "${bundle_dir}/node_modules/tsx/node_modules/@esbuild/${esbuild_platform}"
for dependency in "@template/shared" "drizzle-orm" "mysql2" "zod"; do
  source_path="apps/console/node_modules/${dependency}"
  target_path="${bundle_dir}/apps/console/node_modules/${dependency}"
  [[ -e ${source_path} ]] || { echo "Console worker dependency is missing: ${dependency}" >&2; exit 1; }
  mkdir -p "$(dirname "${target_path}")"
  cp -RL "${source_path}" "${target_path}"
done
mysql2_store=$(find node_modules/.pnpm -maxdepth 1 -type d -name 'mysql2@*' | head -1)
[[ -n ${mysql2_store} && -d ${mysql2_store}/node_modules ]] || { echo "mysql2 dependency closure is missing" >&2; exit 1; }
cp -RL "${mysql2_store}/node_modules/." "${bundle_dir}/apps/console/node_modules/"
for dependency in safer-buffer is-property; do
  dependency_store=$(find node_modules/.pnpm -maxdepth 1 -type d -name "${dependency}@*" | head -1)
  source_path="${dependency_store}/node_modules/${dependency}"
  [[ -n ${dependency_store} && -e ${source_path} ]] || { echo "mysql2 transitive dependency is missing: ${dependency}" >&2; exit 1; }
  cp -RL "${source_path}" "${bundle_dir}/apps/console/node_modules/${dependency}"
done
cp -RL apps/console/src "${bundle_dir}/apps/console/src"
cp -RL apps/console/scripts/knowledge-worker.ts "${bundle_dir}/apps/console/scripts/knowledge-worker.ts"
cp -RL apps/console/package.json apps/console/tsconfig.json "${bundle_dir}/apps/console/"
cp -RL apps/chat/package.json "${bundle_dir}/apps/chat/package.json"
cp -RL packages/shared/src packages/shared/package.json "${bundle_dir}/packages/shared/"
cp -RL package.json pnpm-lock.yaml pnpm-workspace.yaml "${bundle_dir}/"
cp -RL services/agentos/app services/agentos/pyproject.toml services/agentos/uv.lock "${bundle_dir}/services/agentos/"
cp -RL deploy "${bundle_dir}/deploy"

find "${bundle_dir}" -type f -print | sed "s#^${bundle_dir}/##" | LC_ALL=C sort > "${bundle_dir}/.release-manifest"
if find "${bundle_dir}" -type l -print -quit | grep -q .; then
  echo "Release package contains a symbolic link" >&2
  exit 1
fi

tar -C "${bundle_dir}" -czf "${out_dir}/release.tar.gz" .
bundle_kib=$(du -sk "${bundle_dir}" | awk '{print $1}')
archive_bytes=$(wc -c < "${out_dir}/release.tar.gz" | tr -d '[:space:]')
archive_mib=$(( (archive_bytes + 1024 * 1024 - 1) / (1024 * 1024) ))
echo "Release bundle size: ${bundle_kib} KiB"
echo "Release archive size: ${archive_bytes} bytes (${archive_mib} MiB); limit: ${MAX_RELEASE_ARCHIVE_MIB} MiB"
(( archive_bytes <= MAX_RELEASE_ARCHIVE_MIB * 1024 * 1024 )) || { echo "Release archive exceeds budget" >&2; exit 1; }
(
  cd "${out_dir}"
  sha256sum release.tar.gz > release.tar.gz.sha256
  tar -tzf release.tar.gz | sed 's#^\./##' | LC_ALL=C sort > release-manifest.txt
  sha256sum release-manifest.txt > release-manifest.txt.sha256
)
