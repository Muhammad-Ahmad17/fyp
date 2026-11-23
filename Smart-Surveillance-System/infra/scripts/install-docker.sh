#!/usr/bin/env bash
# Installs Docker Engine + Compose v2 on Ubuntu from the distro repositories and lets your user
# run docker without sudo. Run it yourself in a terminal (needs your sudo password):
#   bash infra/scripts/install-docker.sh
set -euo pipefail

sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 docker-buildx

sudo systemctl enable --now docker
sudo usermod -aG docker "$USER"

echo
docker --version || true
docker compose version || true
echo
echo "Log out and back in (or run: newgrp docker) so the 'docker' group applies, then:"
echo "  docker run --rm hello-world"
echo "  cd Smart-Surveillance-System && make up"
