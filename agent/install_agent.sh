#!/bin/bash
# Install and start sparkrun-local-agent on a server
# Run this script on the server where the agent should run

set -e

echo "=== SparkRun Local Agent Installation ==="
echo ""

# Check if running on Linux
if [[ "$(uname)" != "Linux" ]]; then
    echo "Error: This script only works on Linux"
    exit 1
fi

# Check if systemd is available
if ! command -v systemctl &> /dev/null; then
    echo "Error: systemd not found. This script requires systemd."
    exit 1
fi

# Check if binary exists
if [ ! -f /usr/local/bin/sparkrun-local-agent ]; then
    echo "Error: /usr/local/bin/sparkrun-local-agent not found"
    echo "Please copy the binary first with:"
    echo "  sudo cp sparkrun-local-agent /usr/local/bin/"
    echo "  sudo chmod +x /usr/local/bin/sparkrun-local-agent"
    exit 1
fi

echo "✓ Binary found at /usr/local/bin/sparkrun-local-agent"

# Create systemd unit file
echo ""
echo "Creating systemd unit file..."
sudo mkdir -p /etc/systemd/system
sudo tee /etc/systemd/system/sparkrun-local-agent.service > /dev/null << 'EOF'
[Unit]
Description=SparkRun Local Process Monitoring Agent
Documentation=https://github.com/jessenine/sparkrun-ui
After=network.target

[Service]
Type=simple
ExecStart=/usr/local/bin/sparkrun-local-agent --host 0.0.0.0
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

# Resource limits (using correct systemd syntax)
MemoryMax=64M
CPUQuota=10%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sparkrun-local-agent

[Install]
WantedBy=multi-user.target
EOF

echo "✓ Unit file installed"

# Reload systemd
echo ""
echo "Reloading systemd..."
sudo systemctl daemon-reload

# Enable service (starts on boot)
echo "Enabling service..."
sudo systemctl enable sparkrun-local-agent

# Start service
echo "Starting service..."
sudo systemctl start sparkrun-local-agent

# Wait for it to start
sleep 3

# Check status
echo ""
echo "=== Service Status ==="
sudo systemctl status sparkrun-local-agent --no-pager

# Check port binding
echo ""
echo "=== Port Binding ==="
ss -tlnp | grep 8081 || echo "ERROR: Port 8081 not bound!"

# Test endpoint
echo ""
echo "=== Health Check ==="
curl -s http://127.0.0.1:8081/health || echo "ERROR: Health check failed!"

echo ""
echo "=== Installation Complete ==="
echo "Agent should now be running on http://127.0.0.1:8081"
echo "To view logs: sudo journalctl -u sparkrun-local-agent -f"
