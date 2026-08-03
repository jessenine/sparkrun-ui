#!/bin/bash
# Install SparkRun Local Agent - Single Command Installation
# Run this command on each cluster member node:
# curl -sSL https://raw.githubusercontent.com/jessenine/sparkrun-ui/main/deploy/one-liner.sh | sudo bash

set -e

echo "=========================================="
echo "  SparkRun Local Agent Installer"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

# Check for curl
if ! command -v curl &> /dev/null; then
    log_error "curl is required but not installed"
    apt-get update && apt-get install -y curl
fi

log_info "Step 1: Creating project directory..."
mkdir -p /home/shade/Pidev_proj

log_info "Step 2: Cloning repository..."
if [[ ! -d "/home/shade/Pidev_proj/sparkrun-ui" ]]; then
    git clone https://github.com/jessenine/sparkrun-ui.git /home/shade/Pidev_proj/sparkrun-ui
else
    log_info "Repository already exists, updating..."
    cd /home/shade/Pidev_proj/sparkrun-ui
    git pull origin main
fi

log_info "Step 3: Checking Rust installation..."
if ! command -v cargo &> /dev/null; then
    log_info "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

log_info "Step 4: Building agent from source..."
cd /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent
cargo build --release

log_info "Step 5: Installing binary..."
cp target/release/sparkrun-local-agent /usr/local/bin/
chmod 755 /usr/local/bin/sparkrun-local-agent

log_info "Step 6: Creating systemd service..."
cat > /etc/systemd/system/sparkrun-local-agent.service << 'EOF'
[Unit]
Description=SparkRun Local Process Monitoring Agent
Documentation=https://github.com/jessenine/sparkrun-ui
After=network.target

[Service]
Type=simple
User=app
Group=app
ExecStart=/usr/local/bin/sparkrun-local-agent
Restart=always
RestartSec=5

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
MemoryDenyWriteExecute=true

# Resource limits
MemoryLimit=64M
CPUQuota=10%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sparkrun-local-agent

[Install]
WantedBy=multi-user.target
EOF

log_info "Step 7: Creating app user (if needed)..."
if ! id "app" &>/dev/null; then
    useradd -r -s /usr/sbin/nologin -d /var/lib/sparkrun app 2>/dev/null || true
fi

mkdir -p /var/lib/sparkrun
chown app:app /var/lib/sparkrun

log_info "Step 8: Reloading systemd..."
systemctl daemon-reload

log_info "Step 9: Enabling and starting service..."
systemctl enable sparkrun-local-agent
systemctl restart sparkrun-local-agent

log_info "Step 10: Verifying installation..."
sleep 2

if systemctl is-active --quiet sparkrun-local-agent; then
    log_info "✓ Agent service is running"
    
    # Test health endpoint
    if command -v curl &> /dev/null; then
        HEALTH=$(curl -s http://127.0.0.1:8081/health 2>/dev/null)
        if [[ -n "$HEALTH" ]]; then
            log_info "✓ Health endpoint responding"
            echo ""
            echo "Health check response:"
            echo "$HEALTH" | head -c 200
            echo "..."
        else
            log_warn "⚠ Health endpoint not responding (curl may need time)"
        fi
    else
        log_warn "⚠ curl not installed, skipping health check"
    fi
else
    log_error "✗ Agent service failed to start"
    echo ""
    echo "Error logs:"
    journalctl -u sparkrun-local-agent -n 50 --no-pager || true
    exit 1
fi

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Agent is running on http://127.0.0.1:8081"
echo ""
echo "Management commands:"
echo "  systemctl status sparkrun-local-agent"
echo "  systemctl start sparkrun-local-agent"
echo "  systemctl stop sparkrun-local-agent"
echo "  journalctl -u sparkrun-local-agent -f"
echo "  curl http://127.0.0.1:8081/health"
echo ""
echo "Next: Restart the UI on 192.168.1.77"
echo "  sudo systemctl restart sparkrun-ui"
echo ""
