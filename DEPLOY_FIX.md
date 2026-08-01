# Dashboard Metrics Fix - Summary

## Problem
The dashboard metrics (except disk space) were showing 0 because the RPC endpoints were returning "Not found". This was caused by Next.js's file tracer not detecting the ORPC packages and RPC procedure files that are dynamically imported at runtime.

## Root Cause
The ORPC server uses dynamic `import()` to resolve procedures at runtime, which Next.js's file tracer cannot detect during the standalone build. As a result:
1. `@orpc/client` and `@orpc/server` packages were not included in the standalone build
2. `lib/rpc/` procedures were not included in the standalone build
3. The RPC route `/rpc/[[...rest]]` returned 404 because the handler couldn't find the router and procedures

## Solution
Updated the `pack-standalone.mjs` script to:
1. Copy ORPC packages (`@orpc/client`, `@orpc/server`) to both `.next/standalone/node_modules/` and `dist/node_modules/`
2. Copy `lib/rpc/` procedures to both locations
3. Use actual file copies (not symlinks) to avoid broken links in the container

## Files Modified
- `scripts/pack-standalone.mjs` - Added ORPC and RPC procedure copying logic
- `next.config.ts` - No changes (reverted experimental config)

## Files to Deploy
The user needs to copy these files to `192.168.1.77`:
- `dist/` - The standalone build with all dependencies
- `package.json` - Required for the Docker build context
- `bin/sparkrun-ui.mjs` - The UI entry point

## Deployment Steps on 192.168.1.77

### Option 1: Manual deployment (if SSH works)
```bash
# On 192.168.1.77
cd /home/shade/Pidev_proj/sparkrun-ui
docker compose down ui
# Copy new files (from local machine or tarball)
tar xzf /tmp/sparkrun-ui-dist.tar.gz
docker compose build --no-cache ui
docker compose up -d ui
docker image prune -f
```

### Option 2: Using tarball (if SSH doesn't work)
1. Copy `/tmp/sparkrun-ui-dist.tar.gz` to `192.168.1.77` (via USB, network share, etc.)
2. Run the deployment commands above

## Verification
After deployment, verify the dashboard at `http://192.168.1.77:5678/dashboard`:
- Disk usage should show correctly
- Workloads should show real data (not 0)
- RPC endpoints should respond correctly

## Related Files
- `app/rpc/[[...rest]]/route.ts` - RPC route handler (unchanged)
- `lib/rpc/router.ts` - RPC router definition (unchanged)
- `lib/rpc/procedures/` - All RPC procedures (now included in dist)
