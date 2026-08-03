# SparkRun Local Agent - Deployment Instructions

## Quick Start (3 steps)

### Step 1: Clone Repository on Each Cluster Node

SSH to each cluster member node and run:

```bash
ssh jix@<cluster-node-ip>
```

Then on the cluster node, run:

```bash
cd /home/shade/Pidev_proj/sparkrun-ui/deploy
chmod +x deploy-agent.sh
sudo ./deploy-agent.sh
```

### Step 2: Verify Agent is Running

After deployment, verify on each node:

```bash
# Check service status
systemctl status sparkrun-local-agent

# Test health endpoint
curl http://127.0.0.1:8081/health

# Expected output:
# {"status":"healthy","timestamp":1722700000,"agent_id":"...","uptime_seconds":10}
```

### Step 3: Restart UI Service

On the UI server (192.168.1.77):

```bash
sudo systemctl restart sparkrun-ui
```

Then visit: http://192.168.1.77:5678/dashboard

---

## Detailed Deployment Steps

### Prerequisites

- Each cluster member node should have:
  - Linux OS (Ubuntu/Debian)
  - Root/sudo access
  - Internet access to clone GitHub repo
  - Rust installed (script will install if missing)

### Deployment Script

The `deploy-agent.sh` script does the following:

1. **Clones repository** if not present
2. **Installs Rust** if missing
3. **Builds the agent** from source
4. **Installs binary** to `/usr/local/bin/sparkrun-local-agent`
5. **Creates systemd service** with security hardening
6. **Starts the service**
7. **Verifies installation** with health check

### Manual Deployment (if needed)

If you prefer to do it manually:

```bash
# 1. Clone repository
git clone https://github.com/jessenine/sparkrun-ui.git /home/shade/Pidev_proj/sparkrun-ui

# 2. Install Rust (if not already installed)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# 3. Build agent
cd /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent
cargo build --release

# 4. Install binary
sudo cp target/release/sparkrun-local-agent /usr/local/bin/
sudo chmod 755 /usr/local/bin/sparkrun-local-agent

# 5. Create service file
sudo tee /etc/systemd/system/sparkrun-local-agent.service << 'EOF'
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

# 6. Reload and start
sudo systemctl daemon-reload
sudo systemctl enable sparkrun-local-agent
sudo systemctl restart sparkrun-local-agent
```

---

## Verification

### On Each Cluster Node

```bash
# Check if service is running
systemctl status sparkrun-local-agent
# Should show: "Active: active (running)"

# Test health endpoint
curl http://127.0.0.1:8081/health
# Should return JSON with "status": "healthy"

# Test process collection
curl http://127.0.0.1:8081/processes
# Should return JSON with process list

# View logs
journalctl -u sparkrun-local-agent -f
```

### On UI Server

```bash
# Check if UI is accessible
curl http://192.168.1.77:5678/dashboard
# Should return HTML

# Check UI logs
journalctl -u sparkrun-ui -f

# Check if agent queries are working
grep "monitor.processes" /var/log/syslog | grep sparkrun
```

---

## Troubleshooting

### Agent fails to start

```bash
# Check error logs
journalctl -u sparkrun-local-agent -n 50 --no-pager

# Common issues:
# 1. Port 8081 already in use - change port in service file
# 2. Missing Rust installation - run script to install
# 3. Permission issues - ensure running as root
```

### UI doesn't show process data

```bash
# 1. Verify agent is running on cluster nodes
curl http://<cluster-node-ip>:8081/health

# 2. Check UI logs for agent connection errors
journalctl -u sparkrun-ui -f | grep agent

# 3. Verify UI can reach cluster nodes
telnet <cluster-node-ip> 8081
```

### Health endpoint returns empty

```bash
# Check if service is running
systemctl status sparkrun-local-agent

# Check if process is listening
ss -tlnp | grep 8081

# Check service logs
journalctl -u sparkrun-local-agent -f
```

---

## Agent Configuration

The agent binds to `127.0.0.1:8081` by default. Configuration can be adjusted in the service file:

```ini
[Service]
Environment=SPARKRUN_AGENT_PORT=8081
Environment=SPARKRUN_AGENT_HOST=127.0.0.1
Environment=SPARKRUN_AGENT_INTERVAL_MS=2000
Environment=SPARKRUN_AGENT_MAX_PROCESSES=5
```

After changing configuration:

```bash
sudo systemctl daemon-reload
sudo systemctl restart sparkrun-local-agent
```

---

## Uninstall

To remove the agent from a cluster node:

```bash
# Stop and disable service
sudo systemctl stop sparkrun-local-agent
sudo systemctl disable sparkrun-local-agent

# Remove service file
sudo rm /etc/systemd/system/sparkrun-local-agent.service

# Remove binary
sudo rm /usr/local/bin/sparkrun-local-agent

# Reload systemd
sudo systemctl daemon-reload
```

---

## Security Features

The deployment includes these security features:

| Feature | Description |
|---------|-------------|
| Local-only binding | Agent only listens on 127.0.0.1 |
| Unprivileged user | Runs as `app` user, not root |
| Systemd hardening | 6 security restrictions enabled |
| Resource limits | 64M memory, 10% CPU |
| No shell execution | Uses safe APIs only |
| Memory safety | Rust compile-time guarantees |

---

## Need Help?

Check the following files for more details:

- `DEPLOYMENT_GUIDE.md` - Full deployment guide
- `IMPLEMENTATION_SUMMARY.md` - Architecture overview
- `SECURITY_AUDIT.md` - Security analysis
- `agent/sparkrun-local-agent/README.md` - Agent documentation
