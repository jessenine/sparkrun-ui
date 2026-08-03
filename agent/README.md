# SparkRun Local Agent Suite

This directory contains the secure local process monitoring agent implementation.

## Overview

The SparkRun Local Agent is a security-hardened process monitoring solution that replaces SSH-based command execution in the UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      SparkRun UI                             │
│                  (192.168.1.77:5678)                        │
│              Queries agent via HTTP(S)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP GET /processes
                        │
        ┌───────────────▼───────────────┐
        │                               │
        │   Cluster Member Nodes        │
        │   ┌───────────────────────┐   │
        │   │  sparkrun-local-agent │   │
        │   │   (localhost:8081)    │   │
        │   │                       │   │
        │   │  Safe process data    │   │
        │   │  via sysinfo/proc     │   │
        │   └───────────────────────┘   │
        └───────────────────────────────┘
```

## Components

| Component | Path | Description |
|-----------|------|-------------|
| Agent Source | `agent/sparkrun-local-agent/` | Rust source code |
| Agent Client | `lib/rpc/agent/client.ts` | TypeScript client for UI |
| Deployment | `deploy/` | Installation scripts |
| Security Audit | `SECURITY_AUDIT.md` | Full security analysis |

## Quick Start

### Build Agent

```bash
cd agent/sparkrun-local-agent
cargo build --release
```

### Deploy Agent

```bash
cd deploy
sudo ./install.sh
```

### Verify Installation

```bash
curl http://127.0.0.1:8081/health
```

## Development

### Run Agent Locally (Development)

```bash
cd agent/sparkrun-local-agent
cargo run -- --port 8081 --host 127.0.0.1 --interval-ms 2000
```

### Run UI with Agent

```bash
cd /home/shade/Pidev_proj/sparkrun-ui
npm run dev
```

### Run Tests

```bash
# Agent tests
cargo test

# UI client tests
npm run test -- lib/rpc/agent/client.test.ts
```

## Security

### Hardening Features

- ✅ Local-only binding (127.0.0.1)
- ✅ Unprivileged user execution
- ✅ Systemd sandboxing
- ✅ Memory-safe Rust implementation
- ✅ No command injection possible

### Security Audit

See [SECURITY_AUDIT.md](../SECURITY_AUDIT.md) for comprehensive security analysis.

## API Reference

### Health Endpoint

```bash
GET /health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": 1691111111,
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "uptime_seconds": 3600
}
```

### Metrics Endpoint

```bash
GET /metrics
```

Response:
```json
{
  "timestamp": 1691111111,
  "uptime_seconds": 3600,
  "process_count": 150,
  "agent_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Processes Endpoint

```bash
GET /processes
```

Response:
```json
{
  "timestamp": 1691111111,
  "processes": [
    {
      "user": "app",
      "pid": 12345,
      "cpu": 45.5,
      "mem": 12.3,
      "command": "python3 -m vllm"
    }
  ],
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "hostname": "localhost"
}
```

## Troubleshooting

### Agent Won't Start

```bash
# Check service status
sudo systemctl status sparkrun-local-agent

# View logs
sudo journalctl -u sparkrun-local-agent -n 50
```

### Connection Refused

```bash
# Verify agent is running
sudo systemctl is-active sparkrun-local-agent

# Check if port is bound
sudo ss -tlnp | grep 8081
```

### Permission Denied

```bash
# Verify user permissions
sudo id app

# Check file ownership
sudo ls -la /usr/local/bin/sparkrun-local-agent
```

## Deployment

### Manual Installation

1. Copy binary to `/usr/local/bin/sparkrun-local-agent`
2. Copy service file to `/etc/systemd/system/sparkrun-local-agent.service`
3. Run `sudo systemctl daemon-reload`
4. Run `sudo systemctl enable sparkrun-local-agent`
5. Run `sudo systemctl start sparkrun-local-agent`

### Automated Deployment

Use the provided Ansible playbook:

```bash
ansible-playbook deploy/sparkrun-local-agent.yml -i hosts
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SPARKRUN_AGENT_URL` | `http://127.0.0.1:8081` | Agent base URL |
| `SPARKRUN_AGENT_PORT` | `8081` | Agent port |
| `SPARKRUN_AGENT_HOST` | `127.0.0.1` | Agent host |
| `SPARKRUN_AGENT_INTERVAL_MS` | `2000` | Collection interval (ms) |
| `SPARKRUN_AGENT_MAX_PROCESSES` | `5` | Max processes to return |

### CLI Arguments

```bash
sparkrun-local-agent \
    --port 8081 \
    --host 127.0.0.1 \
    --interval-ms 2000 \
    --max-processes 5 \
    --verbose
```

## License

Apache-2.0
