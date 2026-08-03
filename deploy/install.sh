#!/bin/bash
set -euo pipefail

# SparkRun Local Agent Installation Script
# This script installs and configures the local process monitoring agent

echo "=========================================="
echo "  SparkRun Local Agent Installer"
echo "=========================================="

# Configuration
AGENT_VERSION="${AGENT_VERSION:-0.2.0}"
AGENT_PORT="${AGENT_PORT:-8081}"
AGENT_HOST="${AGENT_HOST:-127.0.0.1}"
AGENT_USER="${AGENT_USER:-app}"
AGENT_GROUP="${AGENT_GROUP:-app}"
BIN_DIR="/usr/local/bin"
SERVICE_DIR="/etc/systemd/system"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check for root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root"
    exit 1
fi

# Check if systemd is available
if ! command -v systemctl &> /dev/null; then
    log_error "systemd is required but not available"
    exit 1
fi

log_info "Checking system requirements..."

# Check if agent user exists
if ! id "$AGENT_USER" &>/dev/null; then
    log_info "Creating agent user: $AGENT_USER"
    useradd -r -s /usr/sbin/nologin -d /var/lib/sparkrun "$AGENT_USER" 2>/dev/null || true
fi

# Create directories
log_info "Creating directories..."
mkdir -p /var/lib/sparkrun
chown "$AGENT_USER:$AGENT_GROUP" /var/lib/sparkrun

# Download binary (placeholder - in production use real binary)
log_info "Installing agent binary..."

# Check if binary already exists
if [[ -f "$BIN_DIR/sparkrun-local-agent" ]]; then
    log_info "Found existing binary, backing up..."
    cp "$BIN_DIR/sparkrun-local-agent" "$BIN_DIR/sparkrun-local-agent.bak"
fi

# Check if cargo is available
if ! command -v cargo &> /dev/null; then
    log_error "Cargo/Rust is required but not available. Please install Rust first."
    log_error "Run: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
    exit 1
fi

# Check if agent source exists
if [[ ! -d "/home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent" ]]; then
    log_error "Agent source not found at /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent"
    log_error "Please clone the sparkrun-ui repository first."
    exit 1
fi

# Build the agent from source
log_info "Building agent from source..."
cd /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent
cargo build --release

# Copy binary to /usr/local/bin
log_info "Installing agent binary to $BIN_DIR..."
sudo cp target/release/sparkrun-local-agent "$BIN_DIR/sparkrun-local-agent"
sudo chmod 755 "$BIN_DIR/sparkrun-local-agent"
log_info "Binary installed successfully"

# Create systemd service
log_info "Creating systemd service..."
cat > "$SERVICE_DIR/sparkrun-local-agent.service" << 'SERVICE_EOF'
[Unit]
Description=SparkRun Local Process Monitoring Agent
Documentation=https://github.com/mcampa/sparkrun-ui
After=network.target
Wants=network.target

[Service]
Type=simple
User=app
Group=app
ExecStart=/usr/local/bin/sparkrun-local-agent
Restart=always
RestartSec=5

# Security hardening - critical for production
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
RestrictNamespaces=true
RestrictRealtime=true
RestrictSUIDSGID=true
LockPersonality=true
MemoryDenyWriteExecute=true
SystemCallFilter=@system-service
SystemCallArchitectures=native

# Resource limits
MemoryLimit=64M
CPUQuota=10%
TasksMax=50

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sparkrun-local-agent
Environment=SPARKRUN_AGENT_PORT=8081
Environment=SPARKRUN_AGENT_HOST=127.0.0.1
Environment=SPARKRUN_AGENT_INTERVAL_MS=2000
Environment=SPARKRUN_AGENT_MAX_PROCESSES=5

[Install]
WantedBy=multi-user.target
SERVICE_EOF

chown root:root "$SERVICE_DIR/sparkrun-local-agent.service"
chmod 644 "$SERVICE_DIR/sparkrun-local-agent.service"

# Reload systemd
log_info "Reloading systemd daemon..."
systemctl daemon-reload

# Enable and start service
log_info "Enabling agent service..."
systemctl enable sparkrun-local-agent

log_info "Starting agent service..."
systemctl restart sparkrun-local-agent

# Wait for agent to start
sleep 2

# Verify agent is running
log_info "Verifying agent installation..."

if systemctl is-active --quiet sparkrun-local-agent; then
    log_info "Agent service is running"
    
    # Test health endpoint
    if command -v curl &> /dev/null; then
        HEALTH=$(curl -s http://$AGENT_HOST:$AGENT_PORT/health 2>/dev/null || echo "")
        if [[ -n "$HEALTH" ]]; then
            log_info "Health endpoint responding"
        else
            log_warn "Health endpoint not responding (may need curl)"
        fi
    else
        log_warn "curl not installed, skipping health check"
    fi
else
    log_error "Agent service failed to start"
    journalctl -u sparkrun-local-agent -n 50 --no-pager
    exit 1
fi

# Display installation info
echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "Agent Configuration:"
echo "  - Host: $AGENT_HOST"
echo "  - Port: $AGENT_PORT"
echo "  - User: $AGENT_USER"
echo "  - Binary: $BIN_DIR/sparkrun-local-agent"
echo "  - Service: $SERVICE_DIR/sparkrun-local-agent.service"
echo ""
echo "Agent URLs:"
echo "  - Health: http://$AGENT_HOST:$AGENT_PORT/health"
echo "  - Metrics: http://$AGENT_HOST:$AGENT_PORT/metrics"
echo "  - Processes: http://$AGENT_HOST:$AGENT_PORT/processes"
echo ""
echo "Management Commands:"
echo "  - Status: systemctl status sparkrun-local-agent"
echo "  - Start: systemctl start sparkrun-local-agent"
echo "  - Stop: systemctl stop sparkrun-local-agent"
echo "  - Restart: systemctl restart sparkrun-local-agent"
echo "  - Logs: journalctl -u sparkrun-local-agent -f"
echo ""
echo "To uninstall:"
echo "  systemctl stop sparkrun-local-agent"
echo "  systemctl disable sparkrun-local-agent"
echo "  rm /etc/systemd/system/sparkrun-local-agent.service"
echo "  rm /usr/local/bin/sparkrun-local-agent"
echo "  systemctl daemon-reload"
echo ""

log_info "Installation successful!"
