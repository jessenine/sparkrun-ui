#!/bin/bash
# Rebuild and restart sparkrun-ui Docker container
# Run this on the server (192.168.1.77)

set -e

cd /home/jix/sparkrun-ui

echo "Stopping current container..."
docker stop sparkrun-ui

echo "Building new image..."
docker build -t sparkrun-ui:local \
  --build-arg BUILD_DATE=$(date -Iseconds) \
  --no-cache \
  .

echo "Starting new container..."
docker start sparkrun-ui

echo "Waiting for container to start..."
sleep 5

echo "Checking status..."
docker ps --filter "name=sparkrun-ui"

echo "Testing agent connection..."
curl -s http://127.0.0.1:8081/health || echo "Agent not responding yet"

echo "Done!"
