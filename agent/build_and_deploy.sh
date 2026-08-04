#!/bin/bash
# Build and deploy sparkrun-local-agent to cluster node
# Usage: ./build_and_deploy.sh [cluster_node_ip]

set -e

CLUSTER_NODE="${1:-192.168.1.22}"
CLUSTER_USER="jix"

echo "Building sparkrun-local-agent for $CLUSTER_NODE..."

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$SCRIPT_DIR/sparkrun-local-agent"

# Check if agent source exists
if [ ! -d "$AGENT_DIR" ]; then
    echo "Error: Agent source not found at $AGENT_DIR"
    exit 1
fi

# Create temp directory for build
BUILD_DIR=$(mktemp -d)
echo "Using build directory: $BUILD_DIR"

# Copy source to temp directory
cp -r "$AGENT_DIR"/* "$BUILD_DIR/"
cp -r "$AGENT_DIR"/.gitignore "$BUILD_DIR/" 2>/dev/null || true

# Build for release
cd "$BUILD_DIR"
echo "Building release binary..."
cargo build --release

# Verify build succeeded
if [ ! -f "target/release/sparkrun-local-agent" ]; then
    echo "Error: Build failed - binary not found"
    exit 1
fi

echo "Build successful!"
BINARY_SIZE=$(stat -c%s "target/release/sparkrun-local-agent")
echo "Binary size: $BINARY_SIZE bytes"

# Deploy to cluster node
echo "Deploying to $CLUSTER_USER@$CLUSTER_NODE..."
TEMP_BINARY="/tmp/sparkrun-local-agent-$USER-$(date +%s)"

# Copy to cluster node
scp "target/release/sparkrun-local-agent" "$CLUSTER_USER@$CLUSTER_NODE:$TEMP_BINARY"

echo "Installing on cluster node..."
echo "IMPORTANT: You need to run these commands manually on the cluster node:"
echo ""
echo "  sudo mv $TEMP_BINARY /usr/local/bin/sparkrun-local-agent"
echo "  sudo chmod +x /usr/local/bin/sparkrun-local-agent"
echo "  sudo chown root:root /usr/local/bin/sparkrun-local-agent"
echo "  sudo systemctl restart sparkrun-local-agent"
echo "  sleep 2"
echo "  ss -tlnp | grep 8081"
echo ""
echo "Waiting 30 seconds for you to complete the above steps..."
sleep 30

echo "Restarting agent service..."
ssh "$CLUSTER_USER@$CLUSTER_NODE" "sudo systemctl restart sparkrun-local-agent" || echo "Service restart failed - did you run the sudo commands?"

echo "Waiting for service to start..."
sleep 3

echo "Verifying deployment..."
ssh "$CLUSTER_USER@$CLUSTER_NODE" "ss -tlnp | grep 8081"

echo "Testing endpoint from UI server..."
curl -s "http://$CLUSTER_NODE:8081/health"

# Cleanup
echo "Cleaning up..."
rm -rf "$BUILD_DIR"

echo "Deployment complete!"
echo "Agent should now be accessible at http://$CLUSTER_NODE:8081"
