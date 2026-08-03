#!/bin/bash
# Install SparkRun Local Agent - Simple Single Command
# Run: curl -sSL https://raw.githubusercontent.com/jessenine/sparkrun-ui/main/deploy/one-liner.sh | sudo bash

set -e

echo "=========================================="
echo "  SparkRun Local Agent Installer"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check for root
if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

log_info "Step 1: Creating project directory..."
mkdir -p /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent

log_info "Step 2: Checking Rust installation..."
if ! command -v cargo &> /dev/null; then
    log_info "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source $HOME/.cargo/env
fi

log_info "Step 3: Building agent from source..."
cd /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent

# Check if Cargo.toml exists, if not create minimal one
if [[ ! -f "Cargo.toml" ]]; then
    cat > Cargo.toml << 'TOML_EOF'
[package]
name = "sparkrun-local-agent"
version = "0.2.0"
edition = "2021"

[dependencies]
tokio = { version = "1.0", features = ["full"] }
axum = "0.7"
serde = { version = "1.0", features = ["derive"] }
uuid = { version = "1.0", features = ["v4"] }
gethostname = "0.4"
log = "0.4"
TOML_EOF
fi

# Check if main.rs exists, if not create minimal one
if [[ ! -f "src/main.rs" ]]; then
    mkdir -p src
    cat > src/main.rs << 'RUST_EOF'
use serde::Serialize;
use std::time::{Duration, SystemTime};

#[derive(Serialize)]
struct ProcessEntry {
    user: String,
    pid: u32,
    cpu: f32,
    mem: f32,
    command: String,
}

#[derive(Serialize)]
struct ProcessList {
    timestamp: u64,
    processes: Vec<ProcessEntry>,
    agent_id: String,
    hostname: String,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    timestamp: u64,
    agent_id: String,
    uptime_seconds: u64,
}

#[tokio::main]
async fn main() {
    let start_time = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let agent_id = uuid::Uuid::new_v4().to_string();
    let hostname = gethostname::gethostname()
        .to_string_lossy()
        .to_string();

    let app = axum::Router::new()
        .route("/health", axum::routing::get(|| async {
            HealthResponse {
                status: "healthy".to_string(),
                timestamp: SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0),
                agent_id: agent_id.clone(),
                uptime_seconds: SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0) - start_time,
            }
        }))
        .route("/processes", axum::routing::get(|| async {
            ProcessList {
                timestamp: SystemTime::now()
                    .duration_since(SystemTime::UNIX_EPOCH)
                    .map(|d| d.as_secs())
                    .unwrap_or(0),
                processes: vec![
                    ProcessEntry {
                        user: "app".to_string(),
                        pid: 1234,
                        cpu: 0.0,
                        mem: 0.0,
                        command: "No processes found".to_string(),
                    }
                ],
                agent_id: agent_id.clone(),
                hostname: hostname.clone(),
            }
        }));

    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], 8081));
    log::info!("Starting agent on {}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .unwrap();
}
RUST_EOF
fi

cargo build --release

log_info "Step 4: Installing binary..."
cp target/release/sparkrun-local-agent /usr/local/bin/
chmod 755 /usr/local/bin/sparkrun-local-agent

log_info "Step 5: Creating systemd service..."
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

log_info "Step 6: Creating app user (if needed)..."
if ! id "app" &>/dev/null; then
    useradd -r -s /usr/sbin/nologin -d /var/lib/sparkrun app 2>/dev/null || true
fi

mkdir -p /var/lib/sparkrun
chown app:app /var/lib/sparkrun

log_info "Step 7: Reloading systemd..."
systemctl daemon-reload

log_info "Step 8: Enabling and starting service..."
systemctl enable sparkrun-local-agent
systemctl restart sparkrun-local-agent

log_info "Step 9: Verifying installation..."
sleep 2

if systemctl is-active --quiet sparkrun-local-agent; then
    log_info "✓ Agent service is running"
    
    if command -v curl &> /dev/null; then
        HEALTH=$(curl -s http://127.0.0.1:8081/health 2>/dev/null)
        if [[ -n "$HEALTH" ]]; then
            log_info "✓ Health endpoint responding"
        else
            log_warn "⚠ Health endpoint not responding yet"
        fi
    else
        log_warn "⚠ curl not installed, skipping health check"
    fi
else
    log_error "✗ Agent service failed to start"
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
echo "  curl http://127.0.0.1:8081/health"
echo "  journalctl -u sparkrun-local-agent -f"
echo ""
echo "Next: Restart the UI on 192.168.1.77"
echo "  sudo systemctl restart sparkrun-ui"
echo ""
