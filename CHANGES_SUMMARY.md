# Summary of Changes for Dashboard Metrics Fix

## Problem
The dashboard metrics (except disk space) were showing 0 because RPC endpoints returned "Not found".

## Root Cause
Next.js's file tracer in standalone mode didn't detect:
1. `@orpc/client` and `@orpc/server` packages (dynamic imports by ORPC)
2. `lib/rpc/` procedures (imported by router)

## Solution
Updated `scripts/pack-standalone.mjs` to explicitly copy ORPC packages and RPC procedures to both `.next/standalone/node_modules/` and `dist/`.

## Files Changed

### 1. `scripts/pack-standalone.mjs`
- Added logic to copy `@orpc/client` and `@orpc/server` packages
- Added logic to copy `lib/rpc/` directory
- Used `dereference: true` to copy actual files instead of symlinks

### 2. `lib/rpc/procedures/status.ts`
- Fixed linting error by replacing `any` type with proper type assertion
- Changed from `Object.values(status.groups).map((group: any) => ...)` to using `Object.entries` with proper type checking

### 3. `DEPLOY_FIX.md` (new)
- Documentation for the fix and deployment steps

## Verification
- ✅ All 53 tests pass
- ✅ ESLint passes
- ✅ TypeScript compiles
- ✅ Next.js build succeeds
- ✅ ORPC packages included in `.next/standalone/node_modules/`
- ✅ ORPC packages included in `dist/node_modules/`
- ✅ `lib/rpc/` procedures included in both locations

## Deployment Instructions

### On 192.168.1.77:
```bash
cd /home/shade/Pidev_proj/sparkrun-ui
docker compose down ui
# Copy the dist folder (via tarball or other method)
tar xzf sparkrun-ui-dist.tar.gz
docker compose build --no-cache ui
docker compose up -d ui
docker image prune -f
```

### Verify:
Dashboard at `http://192.168.1.77:5678/dashboard` should show:
- Disk usage (used/total GB and percentage)
- Workloads with real data (not 0)
- All RPC endpoints responding

## Files to Transfer
- `dist/` - Contains the standalone build with all dependencies
- `package.json` - Required for Docker build
- `bin/sparkrun-ui.mjs` - UI entry point
- `lib/rpc/` - Included in dist, but verify it's there
