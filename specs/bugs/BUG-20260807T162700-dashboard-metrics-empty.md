# BUG-20260807T162700: Dashboard metrics and graphs not showing

## Problem

The dashboard at `/dashboard` shows "Loading metrics..." spinner indefinitely and never displays host metrics, sparkline graphs, or any cluster data. The AggregateStats component also shows no data.

**Actual behavior**: Dashboard renders with spinner, no host cards, no metrics, no graphs. Server logs show ENOENT errors from all sparkrun calls.

**Expected behavior**: Dashboard should show live metrics per host with sparkline graphs for CPU, GPU, Memory, Power, and Temperature, plus aggregate stats.

**How to reproduce**: Navigate to `http://192.168.1.77:5678/dashboard` in a browser. Wait 10+ seconds.

## Root Cause Analysis

**Root cause**: The `sparkrun` binary is not available inside the Docker container. The Dockerfile installs `uv` (the Python package manager) but never installs `sparkrun` via `uv tool install sparkrun`. The environment variable `SPARKRUN_BIN=sparkrun` is set, but `sparkrun` is nowhere in `$PATH` inside the container.

**Code path involved**:
1. DashboardLive component mounts → calls `status.get` via RPC → `fetchStatus()` calls `runSparkrunJson(["cluster", "status", "--json"])` → `runSparkrun()` spawns `sparkrun` → `spawn sparkrun ENOENT`
2. The monitor stream effect calls `rpc.monitor.stream({ intervalSec: 2 })` → `streamSparkrunNdjson` spawns `sparkrun cluster monitor` → same ENOENT → stream yields nothing
3. Only `monitor.processes` works because it has a `fetchFromHostAgent()` fallback

**Why no fallbacks exist**: The `status.get` and `monitor.stream` handlers call `runSparkrunJson` / `spawnSparkrun` directly with no catch-and-fallback logic. They assume `sparkrun` is always available.

**Contributing factors**: The Dockerfile header comment says sparkrun should be bind-mounted (`-- mount from host`), but the deployment script never added the bind mount. The `SPARKRUN_BIN` env var points to a bare name, not a known path, so there's no indication at build time that the binary is missing.

**Security impact**: NONE — no exploit path identified. ENOENT is a missing file, not a security vulnerability.

**Risk level**: High — all metrics/graphs functionality is completely broken in deployment.

## TDD Fix Plan

Two approaches are needed: (A) install sparkrun in the Docker image so it's always available, and (B) add fallback logic to `status.get` and `monitor.stream` so they degrade gracefully when sparkrun is missing.

### Approach A: Install sparkrun in Docker image

1. **RED**: No test — this is an infrastructure change not covered by unit tests.
   **GREEN**: Add `RUN uv tool install sparkrun` to Dockerfile after the uv installation step, before the build process. Rebuild and redeploy.
   **verify**: `docker exec sparkrun-ui sparkrun cluster status --json` returns valid JSON

### Approach B: Fallback for status.get

2. **RED**: Write a test that `status.get` returns an empty/zero ClusterStatus when sparkrun is unavailable (mock runSparkrunJson to throw ENOENT-like error).
   **GREEN**: Wrap `runSparkrunJson` in `fetchStatus()` with try/catch that returns a default empty `ClusterStatus` (`{ host_count: null, groups: {}, solo_entries: [], errors: {} }`) when sparkrun fails.
   **verify**: `pnpm test -- lib/rpc/procedures/status.test.ts`

### Approach C: Fallback for monitor.stream

3. **RED**: Write a test that `monitor.stream` yields at least one empty Tick when sparkrun is unavailable (mock streamSparkrunNdjson to yield nothing/throw).
   **GREEN**: Wrap the for-await in `stream` handler to catch errors and yield a fallback tick with empty hosts before completing.
   **verify**: `pnpm test -- lib/rpc/procedures/monitor.test.ts`

**REFACTOR**: Extract a shared `withSparkrunFallback` utility function that encapsulates the "try sparkrun, return empty on ENOENT" pattern used by both handlers. Consider extracting `fetchFromHostAgent()` into a shared module that any handler can import.

## Acceptance Criteria

- [ ] Dockerfile installs sparkrun via `uv tool install sparkrun`
- [ ] Rebuilt container has sparkrun in PATH and `status.get` returns real cluster data
- [ ] monitor.stream yields host metrics when sparkrun is available
- [ ] If sparkrun is unavailable, handlers return empty data instead of crashing with 500
- [ ] All existing tests still pass
- [ ] Clean typecheck (`npx tsc --noEmit`)
