#!/bin/bash
# Complete setup script for sparkrun-local-agent on ARM64 server
# Run this script on the server where the agent should run (192.168.1.77)

set -e

echo "=== SparkRun Local Agent Complete Setup ==="
echo ""

# Check if running on ARM64
ARCH=$(uname -m)
if [ "$ARCH" != "aarch64" ]; then
    echo "Warning: This server is $ARCH, not aarch64 (ARM64)"
    echo "The agent is designed for ARM64 servers (DGX Spark)"
fi

# Step 1: Install Rust if not present
echo "Step 1: Checking for Rust..."
if ! command -v cargo &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
    echo "✓ Rust installed"
else
    echo "✓ Rust already installed"
    cargo --version
fi

# Step 2: Extract agent source
echo ""
echo "Step 2: Extracting agent source..."
if [ ! -f /tmp/agent-source.tar.gz ]; then
    echo "Error: /tmp/agent-source.tar.gz not found"
    echo "Please copy the agent source from your UI server first:"
    echo "  scp jix@192.168.1.77:/tmp/agent-source.tar.gz /tmp/"
    exit 1
fi

mkdir -p /tmp/agent-build
tar -xzf /tmp/agent-source.tar.gz -C /tmp/agent-build
echo "✓ Source extracted"

# Step 3: Build the agent
echo ""
echo "Step 3: Building agent..."
cd /tmp/agent-build
cargo build --release
echo "✓ Build complete"
BINARY_SIZE=$(stat -c%s target/release/sparkrun-local-agent)
echo "  Binary size: $BINARY_SIZE bytes"

# Step 4: Install binary
echo ""
echo "Step 4: Installing binary..."
sudo cp /tmp/agent-build/target/release/sparkrun-local-agent /usr/local/bin/sparkrun-local-agent
sudo chmod +x /usr/local/bin/sparkrun-local-agent
sudo chown root:root /usr/local/bin/sparkrun-local-agent
echo "✓ Binary installed"

# Step 5: Create systemd unit
echo ""
echo "Step 5: Creating systemd unit..."
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

sudo chmod 644 /etc/systemd/system/sparkrun-local-agent.service
echo "✓ Unit file created"

# Step 6: Start service
echo ""
echo "Step 6: Starting service..."
sudo systemctl daemon-reload
sudo systemctl enable sparkrun-local-agent
sudo systemctl start sparkrun-local-agent
sleep 3
echo "✓ Service started"

# Step 7: Verify
echo ""
echo "=== Verification ==="
echo "Service status:"
sudo systemctl status sparkrun-local-agent --no-pager

echo ""
echo "Port binding:"
ss -tlnp | grep 8081

echo ""
echo "Health check:"
curl -s http://127.0.0.1:8081/health

# Step 8: Cleanup
echo ""
echo "Step 8: Cleaning up..."
rm -rf /tmp/agent-source.tar.gz /tmp/agent-build
echo "✓ Cleanup complete"

echo ""
echo "=== Setup Complete ==="
echo "Agent is now running on http://127.0.0.1:8081"
echo "To view logs: sudo journalctl -u sparkrun-local-agent -f"
