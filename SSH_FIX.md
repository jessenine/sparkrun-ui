# SSH Fix for Dashboard Metrics

## Problem

Dashboard showed 0% for all metrics (CPU, GPU, memory, power, temperatures) even though workloads were running.

## Root Causes

1. **SSH Key Path**: The sparkrun config inside the container was pointing to `/home/jix/.config/sparkrun/ssh/sparkrun_ed25519` but the actual mount point was `/home/app/.config/sparkrun/ssh/sparkrun_ed25519`.

2. **SSH User**: The cluster config didn't specify an SSH user, so sparkrun was trying to SSH as `root` instead of `jix`.

3. **SSH Host Key**: The container runs as root but the SSH host keys were only available in `/home/app/.ssh/known_hosts`, causing "Host key verification failed" errors.

## Fixes Applied

### 1. Fix SSH key path
```bash
docker exec sparkrun-ui sed -i 's|/home/jix/.config/sparkrun/ssh/sparkrun_ed25519|/home/app/.config/sparkrun/ssh/sparkrun_ed25519|g' /home/app/.config/sparkrun/config.yaml
```

### 2. Set SSH user
```bash
docker exec sparkrun-ui sparkrun cluster update default -u jix
```

### 3. Add host keys for 127.0.0.1 and 192.168.1.22
```bash
docker exec sparkrun-ui mkdir -p /root/.ssh
docker exec sparkrun-ui sh -c 'ssh-keyscan -H 192.168.1.22 -H 127.0.0.1 2>&1 | tee /root/.ssh/known_hosts'
```

## Verification

After applying fixes, the `/rpc/monitor/stream` endpoint returns metrics for all hosts:

```json
{
  "json": {
    "timestamp": 1785617154.332,
    "hosts": {
      "192.168.1.22": {
        "hostname": "spark-30fc",
        "cpu_usage_pct": "24.6",
        "cpu_temp_c": "81.2",
        "gpu_util_pct": "95",
        "gpu_power_w": "34.76",
        ...
      },
      "127.0.0.1": {
        "hostname": "spark-c149",
        "cpu_usage_pct": "9.8",
        "cpu_temp_c": "72.6",
        "gpu_util_pct": "94",
        "gpu_power_w": "31.04",
        ...
      }
    }
  }
}
```

## Script

A script `scripts/fix-ssh-config.sh` is provided to apply all fixes automatically:

```bash
ssh jix@192.168.1.77 "bash /home/jix/sparkrun-ui/scripts/fix-ssh-config.sh"
```

### Important: SSH Host Keys

The sparkrun-ui container runs as root, but the SSH host keys for remote hosts must be added to `/root/.ssh/known_hosts`. Both `127.0.0.1` and `192.168.1.22` need to be scanned:

```bash
docker exec sparkrun-ui mkdir -p /root/.ssh
docker exec sparkrun-ui sh -c 'ssh-keyscan -H 192.168.1.22 -H 127.0.0.1 2>&1 | tee /root/.ssh/known_hosts'
```

This step is NOT included in the `scripts/fix-ssh-config.sh` because:
- It must be run after the container is created/restarted
- The SSH keyscan command needs to target both hosts explicitly

## Notes

- These fixes are runtime configuration changes and are NOT included in the Docker image build
- The fixes need to be reapplied if the container is recreated
- The `sparkrun cluster update default -u jix` command modifies the cluster config in `/home/app/.config/sparkrun/clusters/default.yaml`
