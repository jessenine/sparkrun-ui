#!/bin/bash
# Set up and build sparkrun-local-agent on the target server
# Usage: ./setup_build_and_deploy.sh <server_ip>

set -e

SERVER="${1:-192.168.1.77}"
USER="${2:-jix}"

echo "=== Setup Build Environment and Deploy ==="
echo "Target: $USER@$SERVER"
echo ""

# Copy agent source to server
echo "Copying agent source to server..."
tar -czf /tmp/agent-source.tar.gz -C "$(dirname "${BASH_SOURCE[0]}")/sparkrun-local-agent" .
scp /tmp/agent-source.tar.gz "$USER@$SERVER:/tmp/agent-source.tar.gz"

echo "Setting up build on $SERVER..."
echo "Run these commands on $SERVER:"

cat << 'EOF'

# On the target server (192.168.1.77), run:

# 1. Install Rust if not present
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# 2. Extract source
mkdir -p /tmp/agent-build
tar -xzf /tmp/agent-source.tar.gz -C /tmp/agent-build

# 3. Build
cd /tmp/agent-build
cargo build --release

# 4. Install binary
sudo cp /tmp/agent-build/target/release/sparkrun-local-agent /usr/local/bin/sparkrun-local-agent
sudo chmod +x /usr/local/bin/sparkrun-local-agent
sudo chown root:root /usr/local/bin/sparkrun-local-agent

# 5. Create systemd unit
sudo tee /etc/systemd/system/sparkrun-local-agent.service > /dev/null << 'UNIT_EOF'
[Unit]
Description=SparkRun Local Process Monitoring Agent
Documentation=https://github.com/jessenine/sparkrun-ui
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/sparkrun-local-agent --host 0.0.0.0
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
MemoryMax=64M
CPUQuota=10%
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sparkrun-local-agent

[Install]
WantedBy=multi-user.target
UNIT_EOF

# 6. Install and start
sudo systemctl daemon-reload
sudo systemctl enable sparkrun-local-agent
sudo systemctl start sparkrun-local-agent

# 7. Verify
sleep 2
curl http://127.0.0.1:8081/health

# 8. Clean up
rm -rf /tmp/agent-source.tar.gz /tmp/agent-build

echo "Deployment complete!"
EOF

# Clean up local temp
rm -f /tmp/agent-source.tar.gz
