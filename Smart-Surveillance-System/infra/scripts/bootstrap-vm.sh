#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu VM for IntelliSafe deployments. Run as root ON THE VM:
#
#   curl -fsSL https://raw.githubusercontent.com/<owner>/fyp/main/Smart-Surveillance-System/infra/scripts/bootstrap-vm.sh \
#     | sudo bash -s -- "$(cat deploy_key.pub)"
#   (or copy the file over and: sudo bash bootstrap-vm.sh "ssh-ed25519 AAAA... github-deploy")
#
# Creates a `deploy` user (docker access, key-only login), installs Docker, opens ports 22/80/443,
# and creates /opt/intellisafe where the pipeline syncs the compose files and where .env lives.
set -euo pipefail

PUBKEY="${1:-}"
[ -n "$PUBKEY" ] || { echo "usage: bootstrap-vm.sh '<ssh public key for the deploy user>'" >&2; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 1; }

apt-get update
apt-get install -y docker.io docker-compose-v2 ufw rsync apache2-utils
systemctl enable --now docker

id deploy >/dev/null 2>&1 || adduser --disabled-password --gecos "" deploy
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
grep -qxF "$PUBKEY" /home/deploy/.ssh/authorized_keys 2>/dev/null || echo "$PUBKEY" >> /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys && chmod 600 /home/deploy/.ssh/authorized_keys

install -d -o deploy -g deploy /opt/intellisafe

ufw allow OpenSSH
ufw allow 80,443/tcp
ufw --force enable

echo
echo "VM ready. Next, as the deploy user:"
echo "  1. create /opt/intellisafe/.env from infra/.env.prod.example (fill in secrets)"
echo "  2. generate mosquitto + Caddy secrets:  cd /opt/intellisafe && bash infra/scripts/gen-secrets.sh"
echo "     (the first pipeline run syncs infra/ there; or scp the infra/ folder once)"
echo "  3. set the GitHub secrets/variable listed in infra/README.md, then push to main."
