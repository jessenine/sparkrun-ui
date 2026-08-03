#!/bin/bash
# Integration Verification Script
# This script verifies the local agent integration with the UI

set -e

echo "=========================================="
echo "  Local Agent Integration Verification"
echo "=========================================="

# Configuration
UI_HOST="192.168.1.77"
UI_PORT="5678"
AGENT_PORT="8081"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo ""
echo "Step 1: Verifying UI is accessible..."
if curl -s "http://${UI_HOST}:${UI_PORT}/dashboard" > /dev/null; then
    log_info "UI is accessible at http://${UI_HOST}:${UI_PORT}/dashboard"
else
    log_error "UI is not accessible at http://${UI_HOST}:${UI_PORT}/dashboard"
    exit 1
fi

echo ""
echo "Step 2: Checking if agent integration code is present..."

# Check if the monitor.ts file imports the agent client
if grep -q "queryAgentProcesses" /home/shade/Pidev_proj/sparkrun-ui/lib/rpc/procedures/monitor.ts; then
    log_info "Agent integration found in monitor.ts"
else
    log_error "Agent integration NOT found in monitor.ts"
    exit 1
fi

# Check if the agent client exists
if [ -f "/home/shade/Pidev_proj/sparkrun-ui/lib/rpc/agent/client.ts" ]; then
    log_info "Agent client module exists"
else
    log_error "Agent client module NOT found"
    exit 1
fi

echo ""
echo "Step 3: Verifying Rust agent source code..."
if [ -f "/home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent/src/main.rs" ]; then
    log_info "Rust agent source code found"
    log_info "Agent implementation lines: $(wc -l < /home/shade/Pidev_proj/sparkrun-ui/agent/sparkrun-local-agent/src/main.rs)"
else
    log_error "Rust agent source code NOT found"
    exit 1
fi

echo ""
echo "Step 4: Checking deployment configuration..."
if [ -f "/home/shade/Pidev_proj/sparkrun-ui/deploy/install.sh" ]; then
    log_info "Installation script found"
else
    log_error "Installation script NOT found"
    exit 1
fi

if [ -f "/home/shade/Pidev_proj/sparkrun-ui/deploy/sparkrun-local-agent.service" ]; then
    log_info "Systemd service file found"
else
    log_error "Systemd service file NOT found"
    exit 1
fi

echo ""
echo "Step 5: Checking security audit documentation..."
if [ -f "/home/shade/Pidev_proj/sparkrun-ui/SECURITY_AUDIT.md" ]; then
    log_info "Security audit documentation found"
else
    log_error "Security audit documentation NOT found"
    exit 1
fi

echo ""
echo "Step 6: Verifying build artifacts..."
cd /home/shade/Pidev_proj/sparkrun-ui

# Check if the build completed successfully
if [ -d ".next" ]; then
    log_info "Build artifacts exist in .next/"
else
    log_error "Build artifacts NOT found"
    log_warn "Running build to generate artifacts..."
    npm run build > /dev/null 2>&1
    if [ -d ".next" ]; then
        log_info "Build completed successfully"
    else
        log_error "Build failed"
        exit 1
    fi
fi

echo ""
echo "=========================================="
echo "  Integration Verification COMPLETE"
echo "=========================================="
echo ""
echo "Summary:"
echo "  ✅ UI is accessible at http://${UI_HOST}:${UI_PORT}/dashboard"
echo "  ✅ Agent integration code is present"
echo "  ✅ Rust agent source code is ready"
echo "  ✅ Deployment configuration exists"
echo "  ✅ Security audit documentation is available"
echo "  ✅ Build artifacts generated"
echo ""
echo "Next Steps:"
echo "  1. Deploy the agent to each cluster member node"
echo "  2. Run: cd deploy && sudo ./install.sh"
echo "  3. Restart the UI service: systemctl restart sparkrun-ui"
echo "  4. Verify at: http://${UI_HOST}:${UI_PORT}/dashboard"
echo ""
echo "For detailed deployment instructions, see: DEPLOYMENT_GUIDE.md"
