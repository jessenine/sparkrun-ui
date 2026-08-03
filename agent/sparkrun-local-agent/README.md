# SparkRun Local Agent

Secure local process monitoring agent for SparkRun cluster nodes.

## Overview

This agent runs on each cluster member node to collect process data securely. It exposes a local HTTP endpoint that the UI can query instead of using SSH, eliminating command injection vulnerabilities.

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

## Security Features

- ✅ **Local-only binding**: Agent binds to 127.0.0.1 by default
- ✅ **Safe APIs**: Uses sysinfo crate, not shell execution
- ✅ **Unprivileged user**: Can run as non-root user
- ✅ **No command injection**: No shell command execution
- ✅ **Minimal attack surface**: Single-purpose agent

## Installation

### Prerequisites

- Rust 1.70+ with Cargo
- Linux kernel (for /proc filesystem access)

### Build

```bash
cd agent/sparkrun-local-agent
cargo build --release
```

### Run

```bash
# Default configuration
./target/release/sparkrun-local-agent

# Custom configuration
./target/release/sparkrun-local-agent \
    --port 8081 \
    --host 127.0.0.1 \
    --interval-ms 2000 \
    --max-processes 5
```

### Systemd Service

Create `/etc/systemd/system/sparkrun-local-agent.service`:

```ini
[Unit]
Description=SparkRun Local Process Monitoring Agent
After=network.target

[Service]
Type=simple
User=sparkrun
Group=sparkrun
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
RestrictFilesystem=!
ReadWritePaths=/var/log

# Resource limits
MemoryLimit=64M
CPUQuota=10%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=sparkrun-local-agent

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl enable sparkrun-local-agent
sudo systemctl start sparkrun-local-agent
```

## API Endpoints

### GET /

Health check endpoint.

### GET /health

Returns agent health status:

```json
{
  "status": "healthy",
  "timestamp": 1691111111,
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "uptime_seconds": 3600
}
```

### GET /metrics

Returns agent metrics:

```json
{
  "timestamp": 1691111111,
  "uptime_seconds": 3600,
  "process_count": 150,
  "agent_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /processes

Returns top processes sorted by CPU usage:

```json
{
  "timestamp": 1691111111,
  "processes": [
    {
      "user": "sparkrun",
      "pid": 12345,
      "cpu": 45.5,
      "mem": 12.3,
      "command": "python3 -m vllm ..."
    }
  ],
  "agent_id": "550e8400-e29b-41d4-a716-446655440000",
  "hostname": "dgx-node-01"
}
```

## Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `--port` | 8081 | Port to listen on |
| `--host` | 127.0.0.1 | Host to bind to |
| `--interval-ms` | 2000 | Process collection interval (ms) |
| `--max-processes` | 5 | Maximum processes to return |
| `--verbose` | false | Enable verbose logging |

## Deployment

### Ansible Playbook (recommended)

Create `deploy/sparkrun-local-agent.yml`:

```yaml
---
- name: Deploy SparkRun Local Agent
  hosts: cluster_nodes
  become: yes
  
  vars:
    agent_version: "0.2.0"
    agent_port: 8081
    agent_interval_ms: 2000
    agent_max_processes: 5
    
  tasks:
    - name: Install Rust toolchain
      include_tasks: tasks/install-rust.yml
      
    - name: Build agent
      command: cargo build --release
      args:
        chdir: /opt/sparkrun-local-agent
      become_user: sparkrun
      
    - name: Copy binary
      copy:
        src: /opt/sparkrun-local-agent/target/release/sparkrun-local-agent
        dest: /usr/local/bin/sparkrun-local-agent
        mode: '0755'
        
    - name: Create systemd service
      copy:
        src: files/sparkrun-local-agent.service
        dest: /etc/systemd/system/sparkrun-local-agent.service
        mode: '0644'
        
    - name: Enable and start service
      systemd:
        name: sparkrun-local-agent
        enabled: yes
        state: started
        daemon_reload: yes
```

## Security Considerations

1. **Network Binding**: Agent binds to 127.0.0.1 by default - never expose to network
2. **User Permissions**: Run as unprivileged user (sparkrun)
3. **Resource Limits**: systemd service includes resource constraints
4. **Namespace Restrictions**: systemd hardens the process namespace
5. **No Shell Execution**: Uses safe sysinfo crate, not shell commands
6. **Memory Protection**: stack protection, ASLR, etc.

## Monitoring

Check agent status:

```bash
# Health check
curl http://127.0.0.1:8081/health

# Get metrics
curl http://127.0.0.1:8081/metrics

# Get process list
curl http://127.0.0.1:8081/processes | jq

# View logs
journalctl -u sparkrun-local-agent -f
```

## Troubleshooting

### Agent won't start

```bash
# Check systemd status
sudo systemctl status sparkrun-local-agent

# View logs
sudo journalctl -u sparkrun-local-agent -n 50
```

### No process data

```bash
# Check /proc access
ls -la /proc/1/stat

# Verify agent is running
ps aux | grep sparkrun-local-agent
```

### Permission denied

```bash
# Ensure correct user
sudo systemctl edit sparkrun-local-agent

# Add to [Service] section:
User=sparkrun
Group=sparkrun
```

## License

Apache-2.0
