#!/bin/bash
# Copy agent source to server before running setup
# Usage: ./prepare_server.sh <server_ip>

set -e

SERVER="${1:-192.168.1.77}"
USER="${2:-jix}"

echo "Preparing server $SERVER for agent setup..."
echo ""

# Copy agent source
echo "Copying agent source to $SERVER..."
tar -czf /tmp/agent-source.tar.gz -C "$(dirname "${BASH_SOURCE[0]}")/sparkrun-local-agent" .
scp /tmp/agent-source.tar.gz "$USER@$SERVER:/tmp/agent-source.tar.gz"

# Copy setup script
echo "Copying setup script to $SERVER..."
scp "$(dirname "${BASH_SOURCE[0]}")/setup_agent_on_server.sh" "$USER@$SERVER:~/setup_agent.sh"

# Clean up
rm -f /tmp/agent-source.tar.gz

echo ""
echo "✓ Ready! Now SSH into $SERVER and run:"
echo "  bash ~/setup_agent.sh"
