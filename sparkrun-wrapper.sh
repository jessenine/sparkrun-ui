#!/usr/bin/env bash
#
# sparkrun-wrapper.sh — Proxy sparkrun CLI calls over SSH to a remote host.
#
# Drop this in place of the sparkrun binary (or point SPARKRUN_BIN at it).
# All sparkrun commands are forwarded via SSH to the remote machine where
# the real sparkrun lives.
#
# Environment variables:
#   SPARKRUN_REMOTE_HOST  — SSH target (default: 192.168.1.22)
#   SPARKRUN_REMOTE_USER  — SSH user (default: shade)
#   SPARKRUN_REMOTE_BIN   — Path to sparkrun on the remote host
#                           (default: ~/.local/bin/sparkrun)

set -euo pipefail

REMOTE_HOST="${SPARKRUN_REMOTE_HOST:-192.168.1.22}"
REMOTE_USER="${SPARKRUN_REMOTE_USER:-shade}"
REMOTE_BIN="${SPARKRUN_REMOTE_BIN:-$HOME/.local/bin/sparkrun}"
SSH_OPTS=(-o StrictHostKeyChecking=accept-new -o ConnectTimeout=5)

# Deploy the remote python runner script once, then reuse it.
REMOTE_SCRIPT="/tmp/_sparkrun_wrapper_runner.py"
DEPLOYED_SCRIPT=$(mktemp)

cat > "$DEPLOYED_SCRIPT" << 'PYEOF'
import json, subprocess, sys, base64

payload = base64.b64decode(sys.argv[1]).decode("utf-8")
cmd = json.loads(payload)

if not cmd:
    sys.exit(0)

proc = subprocess.run(cmd, capture_output=True, text=True)
sys.stdout.write(proc.stdout)
if proc.stderr:
    sys.stderr.write(proc.stderr)
sys.exit(proc.returncode)
PYEOF

# SCP the runner script to the remote host (once)
if ! scp "${SSH_OPTS[@]}" "$DEPLOYED_SCRIPT" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_SCRIPT}"; then
  echo "ERROR: Failed to deploy remote script to ${REMOTE_USER}@${REMOTE_HOST}" >&2
  rm -f "$DEPLOYED_SCRIPT"
  exit 1
fi
rm -f "$DEPLOYED_SCRIPT"

# Collect arguments (skip wrapper's own argv[0] which is "sparkrun")
ARGS=("${@}")

# Forward local draft YAML files to the remote host.
# Draft files are written by the UI to /tmp/sparkrun-ui-drafts/*.yaml
# and passed as arguments to commands like:
#   sparkrun recipe validate /tmp/sparkrun-ui-drafts/xxx.yaml
#   sparkrun run /tmp/sparkrun-ui-drafts/xxx.yaml
#
# We SCP each draft to the remote /tmp/ with the same basename, then
# replace the local path with the remote path in the argument list.

declare -A FILE_CACHE   # local_path -> remote_path
declare -a MAPPED_ARGS

for arg in "${ARGS[@]}"; do
  # Only forward absolute paths that are draft YAML files and exist locally
  if [[ "$arg" == /tmp/sparkrun-ui-drafts/*.yaml ]] && [[ -f "$arg" ]]; then
    local_path="$arg"
    if [[ -z "${FILE_CACHE[$local_path]+x}" ]]; then
      remote_path="/tmp/$(basename "$local_path")"
      scp "${SSH_OPTS[@]}" "$local_path" "${REMOTE_USER}@${REMOTE_HOST}:${remote_path}"
      FILE_CACHE["$local_path"]="$remote_path"
    fi
    MAPPED_ARGS+=("${FILE_CACHE[$local_path]}")
  else
    MAPPED_ARGS+=("$arg")
  fi
done

# Build the command JSON, encode as base64, and execute the remote runner.
JSON_PAYLOAD=$(python3 -c "
import json, sys, base64
print(base64.b64encode(json.dumps(sys.argv[1:]).encode()).decode())
" "$REMOTE_BIN" "${MAPPED_ARGS[@]}")

ssh -T "${SSH_OPTS[@]}" "${REMOTE_USER}@${REMOTE_HOST}" python3 "$REMOTE_SCRIPT" "$JSON_PAYLOAD"
