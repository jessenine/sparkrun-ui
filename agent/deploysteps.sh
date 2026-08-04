#!/bin/bash
# Helper script to show deployment commands
# Run this after copying the binary to the cluster node

CLUSTER_NODE="${1:-192.168.1.22}"
CLUSTER_USER="jix"

echo "=== DEPLOYMENT COMMANDS ==="
echo ""
echo "1. Copy the binary to cluster node:"
echo "   scp target/release/sparkrun-local-agent $CLUSTER_USER@$CLUSTER_NODE:/tmp/sparkrun-local-agent"
echo ""
echo "2. On cluster node ($CLUSTER_NODE), run these commands as user $CLUSTER_USER:"
echo "   sudo mv /tmp/sparkrun-local-agent /usr/local/bin/sparkrun-local-agent"
echo "   sudo chmod +x /usr/local/bin/sparkrun-local-agent"
echo "   sudo chown root:root /usr/local/bin/sparkrun-local-agent"
echo "   sudo systemctl restart sparkrun-local-agent"
echo "   sleep 2"
echo "   ss -tlnp | grep 8081"
echo ""
echo "3. After deployment, test from UI server:"
echo "   curl http://$CLUSTER_NODE:8081/health"
echo ""
