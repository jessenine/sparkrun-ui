# sparkrun-local-agent

Secure process monitoring agent for SparkRun cluster nodes.

## Overview

This agent runs on each cluster member node to collect process data securely. It exposes an HTTP endpoint that the UI can query instead of using SSH.

## Features

- Process monitoring with CPU/memory metrics
- Health endpoint for service checks
- Resource-efficient process data collection via `/proc` filesystem
- ARM64-optimized for DGX Spark nodes

## Building

### On Cluster Node (ARM64)

```bash
# Install Rust if not present
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Build
cargo build --release
```

### Using CI/CD

The `agent-build.yml` workflow handles cross-platform builds and deployment. Trigger it manually from GitHub Actions or let it run automatically when agent code changes.

## Deployment

1. Build the binary (see above)
2. Copy to `/usr/local/bin/sparkrun-local-agent` on the cluster node
3. Ensure systemd service is configured (see below)
4. Restart the service

## systemd Service

```ini
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
```

Save as `/etc/systemd/system/sparkrun-local-agent.service`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable sparkrun-local-agent
sudo systemctl start sparkrun-local-agent
```

## API Endpoints

- `GET /` - Agent info
- `GET /health` - Health check with uptime and agent ID
- `GET /metrics` - Agent metrics
- `GET /processes` - Top processes by CPU usage

## Configuration

```
Usage: sparkrun-local-agent [OPTIONS]

Options:
  -p, --port <PORT>           Port to listen on (default: 8081)
  -h, --host <HOST>           Host to bind to (default: 0.0.0.0)
  -i, --interval-ms <INTERVAL_MS>  Interval between process collection (default: 2000)
  -m, --max-processes <MAX_PROCESSES>  Maximum number of processes to return (default: 5)
  -v, --verbose               Enable verbose logging
  -h, --help                  Print help
  -V, --version               Print version
```

## Troubleshooting

### Binary won't execute (status=203/EXEC)

The binary architecture doesn't match the node. Build on ARM64, not x86.

### Not listening on port 8081

Check the systemd status: `sudo systemctl status sparkrun-local-agent`

Verify the binary permissions: `ls -la /usr/local/bin/sparkrun-local-agent`

### Service won't start

Check logs: `journalctl -u sparkrun-local-agent -f`

Common issues:
- Insufficient MemoryMax/CPUQuota
- Missing dependencies (check `ldd` output)
- Port already in use

## Security

- Runs as root but with `NoNewPrivileges=true`
- Accesses only `/proc` filesystem (no shell execution)
- Resource limits enforced via systemd
- No network access outside localhost unless explicitly configured
