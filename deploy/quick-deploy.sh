#!/bin/bash
# Quick Deployment Script for SparkRun Local Agent
# This script deploys the agent to all cluster member nodes

set -e

echo "=========================================="
echo "  SparkRun Local Agent Quick Deploy"
echo "=========================================="

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="/home/shade/Pidev_proj/sparkrun-ui"
CLUSTER_MEMBERS=("192.168.1.10" "192.168.1.11" "192.168.1.12")  # Update with your cluster members
SSH_USER="jix"  # Update with your SSH username
UI_SERVER="192.168.1.77"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

# Check if running on UI server
if [[ "$(hostname -I | awk '{print $1}')" != "$UI_SERVER" ]]; then
    log_error "This script must be run on the UI server ($UI_SERVER)"
    exit 1
fi

log_info "Starting deployment to cluster members..."

# Deploy to each cluster member
for host in "${CLUSTER_MEMBERS[@]}"; do
    echo ""
    echo "=========================================="
    echo "  Deploying to $host"
    echo "=========================================="
    
    # Copy deployment files to cluster member
    log_info "Copying deployment files to $host..."
    ssh "$SSH_USER@$host" "mkdir -p /home/$SSH_USER/sparkrun-ui-deploy"
    scp -r "$SCRIPT_DIR/." "$SSH_USER@$host:/home/$SSH_USER/sparkrun-ui-deploy/"
    
    # Run installation script
    log_info "Installing agent on $host..."
    ssh "$SSH_USER@$host" "cd /home/$SSH_USER/sparkrun-ui-deploy && sudo ./install.sh"
    
    # Verify installation
    log_info "Verifying installation on $host..."
    ssh "$SSH_USER@$host" "curl -s http://127.0.0.1:8081/health" || {
        log_error "Agent installation failed on $host"
        exit 1
    }
    
    log_info "Agent successfully deployed to $host"
done

echo ""
echo "=========================================="
echo "  Deployment Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "  1. Restart the UI service on $UI_SERVER:"
echo "     sudo systemctl restart sparkrun-ui"
echo ""
echo "  2. Verify the dashboard shows process data:"
echo "     http://$UI_SERVER:5678/dashboard"
echo ""
echo "  3. Check agent logs on each cluster member:"
echo "     journalctl -u sparkrun-local-agent -f"
echo ""
echo "  4. To uninstall from all nodes:"
echo "     for host in ${CLUSTER_MEMBERS[*]}; do"
echo "       ssh $SSH_USER@\\$host 'sudo systemctl stop sparkrun-local-agent'"
echo "       ssh $SSH_USER@\\$host 'sudo systemctl disable sparkrun-local-agent'"
echo "       ssh $SSH_USER@\\$host 'sudo rm /etc/systemd/system/sparkrun-local-agent.service'"
echo "       ssh $SSH_USER@\\$host 'sudo rm /usr/local/bin/sparkrun-local-agent'"
echo "       ssh $SSH_USER@\\$host 'sudo systemctl daemon-reload'"
echo "     done"
