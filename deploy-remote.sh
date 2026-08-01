#!/bin/bash
# Deploy script for sparkrun-ui
# Run this on 192.168.1.77 after copying the dist tarball

set -e

echo "Stopping current service..."
ssh jix@192.168.1.77 "cd /home/jix/sparkrun-ui && docker compose down sparkrun-ui"

echo "Copying dist files..."
scp dist.tar.gz jix@192.168.1.77:/home/jix/sparkrun-ui/dist.tar.gz

echo "Deploying on remote host..."
ssh jix@192.168.1.77 "
  cd /home/jix/sparkrun-ui
  tar xzf dist.tar.gz
  rm dist.tar.gz
  docker compose build --no-cache sparkrun-ui
  docker compose up -d sparkrun-ui
  docker image prune -f
"

echo "Fixing SSH configuration..."
ssh jix@192.168.1.77 "
  echo 'Fixing SSH key path...'
  docker exec sparkrun-ui sed -i 's|/home/jix/.config/sparkrun/ssh/sparkrun_ed25519|/home/app/.config/sparkrun/ssh/sparkrun_ed25519|g' /home/app/.config/sparkrun/config.yaml

  echo 'Setting SSH user...'
  docker exec sparkrun-ui sparkrun cluster update default -u jix

  echo 'Adding host keys for 192.168.1.22 and 127.0.0.1...'
  docker exec sparkrun-ui mkdir -p /root/.ssh
  docker exec sparkrun-ui sh -c 'ssh-keyscan 192.168.1.22 127.0.0.1 2>&1 | tee /root/.ssh/known_hosts'

  echo 'Verifying SSH configuration...'
  docker exec sparkrun-ui sparkrun cluster show default
"

echo "Done! Verify at http://192.168.1.77:5678/dashboard"
