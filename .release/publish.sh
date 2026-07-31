#!/usr/bin/env bash
set -euo pipefail

release_id=${1:-}
release_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd "${release_dir}/.." && pwd)
source "${release_dir}/project.env"

required_vars=(DEPLOY_ECS_HOST DEPLOY_ECS_USER DEPLOY_ECS_SSH_KEY DEPLOY_HOME_SSH_KEY DEPLOY_KNOWN_HOSTS)
for name in "${required_vars[@]}"; do
  [[ -n ${!name:-} ]] || { echo "Missing required secret: ${name}" >&2; exit 1; }
done
[[ ${release_id} =~ ^v[0-9A-Za-z._-]+$ ]] || { echo "Invalid release id" >&2; exit 1; }
archive=${release_dir}/out/release.tar.gz
checksum=$(awk '{print $1}' "${archive}.sha256")
[[ ${checksum} =~ ^[0-9a-f]{64}$ ]] || { echo "Invalid release checksum" >&2; exit 1; }

tmp_dir=$(mktemp -d)
trap 'rm -rf "${tmp_dir}"' EXIT
umask 077
printf '%s\n' "${DEPLOY_ECS_SSH_KEY}" > "${tmp_dir}/ecs_key"
printf '%s\n' "${DEPLOY_HOME_SSH_KEY}" > "${tmp_dir}/home_key"
printf '%s\n' "${DEPLOY_KNOWN_HOSTS}" > "${tmp_dir}/known_hosts"
chmod 0600 "${tmp_dir}/ecs_key" "${tmp_dir}/home_key" "${tmp_dir}/known_hosts"
cat > "${tmp_dir}/ssh_config" <<SSH_CONFIG
Host release-ecs
    HostName ${DEPLOY_ECS_HOST}
    User ${DEPLOY_ECS_USER}
    Port 22
    IdentityFile ${tmp_dir}/ecs_key
    IdentitiesOnly yes
    HostKeyAlias release-ecs
    UserKnownHostsFile ${tmp_dir}/known_hosts
    StrictHostKeyChecking yes
    ServerAliveInterval 15
    ServerAliveCountMax 4

Host release-home
    HostName 127.0.0.1
    User codex-ops
    Port 18080
    IdentityFile ${tmp_dir}/home_key
    IdentitiesOnly yes
    ProxyJump release-ecs
    HostKeyAlias release-home
    UserKnownHostsFile ${tmp_dir}/known_hosts
    StrictHostKeyChecking yes
    ServerAliveInterval 15
    ServerAliveCountMax 4
SSH_CONFIG
chmod 0600 "${tmp_dir}/ssh_config"

bootstrap_path=/home/codex-ops/incoming/agent-template-bootstrap-${release_id}
ssh -F "${tmp_dir}/ssh_config" release-home "mkdir -p '${bootstrap_path}'"
scp -F "${tmp_dir}/ssh_config" "${project_dir}/deploy/agent-template-deploy" "release-home:${bootstrap_path}/agent-template-deploy"
for unit in agent-template-agentos.service agent-template-chat.service agent-template-console.service agent-template-worker.service; do
  scp -F "${tmp_dir}/ssh_config" "${project_dir}/deploy/${unit}" "release-home:${bootstrap_path}/${unit}"
done
scp -F "${tmp_dir}/ssh_config" "${project_dir}/deploy/agent-template.locations.conf" "release-home:${bootstrap_path}/agent-template.locations.conf"
scp -F "${tmp_dir}/ssh_config" "${project_dir}/deploy/agent-template-release.sudoers" "release-home:${bootstrap_path}/agent-template-release.sudoers"
ssh -F "${tmp_dir}/ssh_config" release-home "sudo install -o root -g root -m 0755 '${bootstrap_path}/agent-template-deploy' /usr/local/sbin/agent-template-deploy && sudo install -o root -g root -m 0644 '${bootstrap_path}/agent-template-agentos.service' /etc/systemd/system/agent-template-agentos.service && sudo install -o root -g root -m 0644 '${bootstrap_path}/agent-template-chat.service' /etc/systemd/system/agent-template-chat.service && sudo install -o root -g root -m 0644 '${bootstrap_path}/agent-template-console.service' /etc/systemd/system/agent-template-console.service && sudo install -o root -g root -m 0644 '${bootstrap_path}/agent-template-worker.service' /etc/systemd/system/agent-template-worker.service && sudo install -o root -g root -m 0644 '${bootstrap_path}/agent-template.locations.conf' /home/middleware/nginx/conf/conf.d/agent-template.locations.conf && sudo install -o root -g root -m 0440 '${bootstrap_path}/agent-template-release.sudoers' /etc/sudoers.d/92-agent-template-release && sudo visudo -cf /etc/sudoers.d/92-agent-template-release && sudo systemctl daemon-reload"
"${release_dir}/preflight.sh" remote --ssh-config "${tmp_dir}/ssh_config"
remote_archive=/home/codex-ops/incoming/agent-template-${release_id}.tar.gz
scp -F "${tmp_dir}/ssh_config" "${archive}" "release-home:${remote_archive}"
ssh -F "${tmp_dir}/ssh_config" release-home "sudo /usr/local/sbin/agent-template-deploy '${release_id}' '${remote_archive}' '${checksum}'"
curl --fail --silent --show-error --location --connect-timeout 5 --max-time 20 "${PUBLIC_HEALTH_URL}"
echo "Published agent-template ${release_id}."
