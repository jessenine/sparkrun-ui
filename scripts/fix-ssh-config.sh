#!/bin/bash
# Fix SSH configuration issues in the sparkrun-ui container
# Run this on the host (192.168.1.77) after deploying the UI

set -e

echo "Fixing SSH key path in sparkrun config..."
docker exec sparkrun-ui sed -i 's|/home/jix/.config/sparkrun/ssh/sparkrun_ed25519|/home/app/.config/sparkrun/ssh/sparkrun_ed25519|g' /home/app/.config/sparkrun/config.yaml

echo "Setting SSH user in cluster config..."
docker exec sparkrun-ui sparkrun cluster update default -u jix

echo "Adding 127.0.0.1 host key to root's known_hosts..."
docker exec sparkrun-ui sh -c 'ssh-keyscan -H 127.0.0.1 2>&1 | tee -a /root/.ssh/known_hosts'

echo "Verifying configuration..."
docker exec sparkrun-ui sparkrun cluster show default

echo ""
echo "Testing monitor command..."
docker exec sparkrun-ui sparkrun cluster monitor --json 2>&1 | head -1 | python3 -m json.tool 2>&1 | grep -E '"host"|"error"|"sample"|"hostname"|"cpu_usage_pct"|"gpu_util_pct"'

echo ""
echo "Done! Dashboard should now show metrics at http://192.168.1.77:5678/dashboard"
