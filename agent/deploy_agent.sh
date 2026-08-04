#!/bin/bash
# Deploy sparkrun-local-agent to a server
# Usage: ./deploy_agent.sh <server_ip>
# Requires: SSH access and sudo on the target server

set -e

SERVER="${1:-192.168.1.77}"
USER="${2:-jix}"

echo "=== Deploy SparkRun Local Agent ==="
echo "Target: $USER@$SERVER"
echo ""

# Check if source binary exists
if [ ! -f "target/release/sparkrun-local-agent" ]; then
    echo "Error: target/release/sparkrun-local-agent not found"
    echo "Please build first: cd sparkrun-local-agent && cargo build --release"
    exit 1
fi

echo "✓ Found binary (x86-64 build)"
echo "  This assumes the target server is x86-64."
echo "  If target is ARM64, build on that server instead."
echo ""

# Copy binary to target
echo "Copying binary to $SERVER..."
scp "target/release/sparkrun-local-agent" "$USER@$SERVER:/tmp/sparkrun-local-agent"

echo "Installing on $SERVER..."
echo "Run these commands on $SERVER:"

cat << 'EOF'

# On the target server, run:
sudo mv /tmp/sparkrun-local-agent /usr/local/bin/sparkrun-local-agent
sudo chmod +x /usr/local/bin/sparkrun-local-agent
sudo chown root:root /usr/local/bin/sparkrun-local-agent

# Then install and start the service
sudo bash install_agent.sh

# Verify
curl http://127.0.0.1:8081/health
EOF
