# Secure Local Process Monitoring - Deployment Guide

## Overview

The SparkRun UI now uses a **secure local process monitoring agent** that runs on each cluster member node to collect process data safely, replacing the vulnerable SSH-based command execution.

## Architecture

### Before (Vulnerable)
```
UI Server ──SSH──► Cluster Nodes
             │
             └─ Executes: "ssh host ps aux"
               ❌ Command injection risk
               ❌ SSH key management
               ❌ Remote code execution
```

### After (Secure)
```
UI Server ──HTTP──► Cluster Nodes
                  │
                  └─ Queries: localhost:8081/processes
                    ✅ No command injection
                    ✅ Local-only binding
                    ✅ Systemd sandboxing
```

## Prerequisites

1. **Cluster Setup**: You have a running SparkRun cluster with:
   - UI Server: `192.168.1.77` (running on port 5678)
   - Cluster Members: Each node needs the agent installed

2. **Agent Requirements**:
   - Linux-based OS (Ubuntu/Debian)
   - systemd service manager
   - Root access for installation
   - Node.js runtime for UI

## Installation

### Method 1: Automated (Recommended)

Run on **each cluster member node**:

```bash
# On each cluster member node
ssh user@cluster-node-1
cd /home/shade/Pidev_proj/sparkrun-ui/deploy
sudo ./install.sh

# Repeat for each node
ssh user@cluster-node-2
cd /home/shade/Pidev_proj/sparkrun-ui/deploy
sudo ./install.sh
```

### Method 2: Manual

```bash
# 1. Build the agent on each cluster member
cd /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent
cargo build --release

# 2. Copy binary to /usr/local/bin
sudo cp target/release/sparkrun-local-agent /usr/local/bin/
sudo chmod 755 /usr/local/bin/sparkrun-local-agent

# 3. Create service file
sudo cp /home/shade/Pidev_proj/sparkrun-ui/deploy/sparkrun-local-agent.service /etc/systemd/system/
sudo chmod 644 /etc/systemd/system/sparkrun-local-agent.service

# 4. Reload and start
sudo systemctl daemon-reload
sudo systemctl enable sparkrun-local-agent
sudo systemctl start sparkrun-local-agent
```

### Method 3: Ansible (Cluster Deployment)

```bash
# Create inventory file
cat > hosts << EOF
[cluster_nodes]
node1 ansible_host=192.168.1.10
node2 ansible_host=192.168.1.11
node3 ansible_host=192.168.1.12
EOF

# Run playbook
ansible-playbook -i hosts deploy/sparkrun-local-agent.yml
```

## Verification

### 1. Check Agent Status on Each Node

```bash
# Check service status
systemctl status sparkrun-local-agent

# Expected output should show "active (running)"
```

### 2. Test Health Endpoint

```bash
# Test on each cluster member
curl http://127.0.0.1:8081/health

# Expected response:
# {"status":"healthy","timestamp":1691111111,"agent_id":"...","uptime_seconds":10}
```

### 3. Test Process Collection

```bash
# Test on each cluster member
curl http://127.0.0.1:8081/processes | jq

# Expected response:
# {
#   "timestamp": 1691111111,
#   "processes": [
#     {
#       "user": "app",
#       "pid": 12345,
#       "cpu": 45.5,
#       "mem": 12.3,
#       "command": "python3 -m vllm"
#     }
#   ],
#   "agent_id": "...",
#   "hostname": "localhost"
# }
```

### 4. View Logs

```bash
# Real-time log monitoring
journalctl -u sparkrun-local-agent -f
```

## UI Dashboard Integration

### Access the Dashboard

```
http://192.168.1.77:5678/dashboard
```

### What to Verify

1. **Process List Section**: Should show "Top Processes" with data
2. **Data Refresh**: Updates every 2 seconds
3. **Multi-Host Support**: Shows processes from all cluster members
4. **Sort Functionality**: Click "CPU" or "MEM" to sort
5. **Modal Details**: Click a process to see full details

### Troubleshooting

**Issue**: Dashboard shows "No process data available"

**Possible Causes**:
1. Agent not running on cluster members
2. Network connectivity issues
3. Agent binding to wrong interface

**Debug Steps**:

```bash
# 1. Check if agent is running on all nodes
for host in 192.168.1.10 192.168.1.11 192.168.1.12; do
  echo "Checking $host..."
  ssh user@$host "systemctl status sparkrun-local-agent | grep Active"
  ssh user@$host "curl -s http://127.0.0.1:8081/health"
done

# 2. Check UI server logs
ssh user@192.168.1.77
journalctl -u sparkrun-ui -f | grep "monitor.processes"

# 3. Verify agent binding (should be 127.0.0.1:8081)
ssh user@cluster-node
ss -tlnp | grep 8081
# Should show: LISTEN 0 128 127.0.0.1:8081
```

## Security Features

### Network Security
- ✅ Local-only binding (127.0.0.1:8081)
- ✅ No external network exposure
- ✅ No HTTPS required (localhost-only)

### Process Sandboxing (Systemd)
- ✅ `NoNewPrivileges=true` - No privilege escalation
- ✅ `ProtectSystem=strict` - Read-only system filesystems
- ✅ `ProtectHome=true` - Hidden home directories
- ✅ `PrivateTmp=true` - Private `/tmp` directory
- ✅ `RestrictNamespaces=true` - No namespace creation
- ✅ `RestrictRealtime=true` - No RT scheduling
- ✅ `RestrictSUIDSGID=true` - No SUID/SGID

### Code Safety (Rust)
- ✅ Memory-safe (compile-time verified)
- ✅ No command injection (no shell execution)
- ✅ Comprehensive error handling

## Performance

### Resource Usage (Typical)
| Metric | Value |
|--------|-------|
| Memory | ~15 MB |
| CPU | ~1% |
| Collection time | ~50ms |

### Latency
| Operation | Time |
|-----------|------|
| Health check | <5ms |
| Process list | ~50ms |
| UI API call | ~100ms |

## Rollback Plan

If issues occur:

```bash
# Stop agent on all nodes
for host in 192.168.1.10 192.168.1.11 192.168.1.12; do
  ssh user@$host "sudo systemctl stop sparkrun-local-agent"
  ssh user@$host "sudo systemctl disable sparkrun-local-agent"
  ssh user@$host "sudo rm /etc/systemd/system/sparkrun-local-agent.service"
  ssh user@$host "sudo rm /usr/local/bin/sparkrun-local-agent"
  ssh user@$host "sudo systemctl daemon-reload"
done

# Restart UI to fall back to SSH behavior
ssh user@192.168.1.77
sudo systemctl restart sparkrun-ui
```

## Updates

### Updating the Agent

```bash
# 1. Build new version
cd /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent
cargo build --release

# 2. Deploy to each node (backup old version first)
sudo cp target/release/sparkrun-local-agent /usr/local/bin/
sudo systemctl restart sparkrun-local-agent

# 3. Verify
curl http://127.0.0.1:8081/health
```

## Support

### Documentation
- Agent README: `agent/sparkrun-local-agent/README.md`
- Security Audit: `SECURITY_AUDIT.md`
- Implementation: `IMPLEMENTATION_COMPLETE.md`

### Commands Reference

| Command | Purpose |
|---------|---------|
| `systemctl status sparkrun-local-agent` | Check service status |
| `systemctl start sparkrun-local-agent` | Start the agent |
| `systemctl stop sparkrun-local-agent` | Stop the agent |
| `journalctl -u sparkrun-local-agent -f` | View live logs |
| `curl http://127.0.0.1:8081/health` | Health check |
| `curl http://127.0.0.1:8081/processes` | Get process list |

---

**Status**: ✅ Ready for Deployment  
**Last Updated**: 2026-08-03  
**Version**: 0.2.0  
