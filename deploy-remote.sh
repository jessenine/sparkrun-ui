#!/bin/bash
# Deploy script for sparkrun-ui
# Run this on 192.168.1.77 after copying the dist tarball

set -e

echo "Stopping current service..."
ssh jix@192.168.1.77 "cd /home/jix/Pidev_proj/sparkrun-ui && docker compose down ui"

echo "Copying dist files..."
scp dist.tar.gz jix@192.168.1.77:/home/jix/Pidev_proj/sparkrun-ui/dist.tar.gz

echo "Deploying on remote host..."
ssh jix@192.168.1.77 "
  cd /home/jix/Pidev_proj/sparkrun-ui
  tar xzf dist.tar.gz
  rm dist.tar.gz
  docker compose build --no-cache ui
  docker compose up -d ui
  docker image prune -f
"

echo "Done! Verify at http://192.168.1.77:5678/dashboard"
