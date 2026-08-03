#!/bin/bash
# Simple deployment script for SparkRun Local Agent
# Run this script on each cluster member node

set -e

echo "=========================================="
echo "  SparkRun Local Agent Deployment"
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
    log_error "This script must be run as root"
    exit 1
fi

log_info "Step 1: Cloning repository..."
if [[ ! -d "/home/shade/Pidev_proj/sparkrun-ui" ]]; then
    mkdir -p /home/shade/Pidev_proj
    git clone https://github.com/jessenine/sparkrun-ui.git /home/shade/Pidev_proj/sparkrun-ui
fi

log_info "Step 2: Checking Rust installation..."
if ! command -v cargo &> /dev/null; then
    log_info "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

log_info "Step 3: Building agent from source..."
cd /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent
cargo build --release

log_info "Step 4: Installing binary..."
cp target/release/sparkrun-local-agent /usr/local/bin/
chmod 755 /usr/local/bin/sparkrun-local-agent

log_info "Step 5: Creating systemd service..."
cat > /etc/systemd/system/sparkrun-local-agent.service << 'EOF'
[Unit]
Description=SparkRun Local Process Monitoring Agent
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

# Resource limits
MemoryLimit=64M
CPUQuota=10%

[Install]
WantedBy=multi-user.target
EOF

log_info "Step 6: Reloading systemd..."
systemctl daemon-reload

log_info "Step 7: Enabling and starting service..."
systemctl enable sparkrun-local-agent
systemctl restart sparkrun-local-agent

log_info "Step 8: Verifying installation..."
sleep 2

if systemctl is-active --quiet sparkrun-local-agent; then
    log_info "✓ Agent service is running"
    
    # Test health endpoint
    if command -v curl &> /dev/null; then
        HEALTH=$(curl -s http://127.0.0.1:8081/health 2>/dev/null)
        if [[ -n "$HEALTH" ]]; then
            log_info "✓ Health endpoint responding"
        else
            log_warn "⚠ Health endpoint not responding"
        fi
    else
        log_warn "⚠ curl not installed, skipping health check"
    fi
else
    log_error "✗ Agent service failed to start"
    journalctl -u sparkrun-local-agent -n 50 --no-pager
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
echo "  Status: systemctl status sparkrun-local-agent"
echo "  Logs: journalctl -u sparkrun-local-agent -f"
echo "  Health: curl http://127.0.0.1:8081/health"
echo ""
