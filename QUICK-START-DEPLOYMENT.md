# 🚀 Quick Deployment Guide

## Run This Command on Each Cluster Node

```bash
curl -sSL https://raw.githubusercontent.com/jessenine/sparkrun-ui/main/deploy/install-agent.sh | sudo bash
```

That's it! The script will:
1. ✅ Install Rust if needed
2. ✅ Download and build the agent
3. ✅ Install systemd service with security hardening
4. ✅ Start the agent on localhost:8081
5. ✅ Verify installation with health check

---

## Verify Installation

After running the script, test on each cluster node:

```bash
# Check service status
systemctl status sparkrun-local-agent

# Test health endpoint
curl http://127.0.0.1:8081/health
```

Expected output:
```json
{"status":"healthy","timestamp":1722700000,"agent_id":"...","uptime_seconds":10}
```

---

## After Deploying to All Nodes

On the **UI Server (192.168.1.77)**:

```bash
sudo systemctl restart sparkrun-ui
```

Then visit: http://192.168.1.77:5678/dashboard

---

## Management Commands

```bash
# View service status
systemctl status sparkrun-local-agent

# Start/stop service
sudo systemctl start sparkrun-local-agent
sudo systemctl stop sparkrun-local-agent

# View logs
journalctl -u sparkrun-local-agent -f

# Test health endpoint
curl http://127.0.0.1:8081/health

# Get process data
curl http://127.0.0.1:8081/processes
```

---

## Uninstall

To remove from a cluster node:

```bash
sudo systemctl stop sparkrun-local-agent
sudo systemctl disable sparkrun-local-agent
sudo rm /etc/systemd/system/sparkrun-local-agent.service
sudo rm /usr/local/bin/sparkrun-local-agent
sudo systemctl daemon-reload
```

---

## Troubleshooting

### Service won't start

```bash
# Check logs
journalctl -u sparkrun-local-agent -n 50 --no-pager
```

### Health endpoint not responding

```bash
# Check if service is running
systemctl is-active sparkrun-local-agent

# Check if port is listening
ss -tlnp | grep 8081
```

### UI doesn't show process data

1. Verify agent is running on cluster nodes: `curl http://localhost:8081/health`
2. Check UI service: `sudo systemctl restart sparkrun-ui`
3. Check UI logs: `journalctl -u sparkrun-ui -f`

---

## Security Features

- ✅ Local-only binding (127.0.0.1:8081)
- ✅ Runs as unprivileged `app` user
- ✅ Systemd sandboxing enabled
- ✅ Resource limits (64M memory, 10% CPU)
- ✅ No command injection risk

---

## Full Documentation

For more details, see:
- [DEPLOYMENT_INSTRUCTIONS.md](DEPLOYMENT_INSTRUCTIONS.md)
- [SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)

---

**Status**: ✅ Ready to Deploy  
**Last Updated**: 2026-08-03  
**Version**: 0.2.0
