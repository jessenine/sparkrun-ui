# BUG-20260807T062700: Process list always empty ("No process data available")

## Problem

The process list component on the dashboard always shows "No process data available", regardless of running workloads on the cluster.

**Actual behavior:** The RPC endpoint `/rpc/monitor.processes` returns an empty `processes` array. The console logs show: `[monitor.processes] Error running ps aux on {host}: sparkrun host exec is not a valid sparkrun command`.

**Expected behavior:** The dashboard process list shows the top 5 processes by CPU usage for each host in the cluster.

## Root Cause Analysis

The `processes` RPC handler in the monitor procedure attempts to run `sparkrun host exec {host} -- ps aux` to fetch per-host process data. However, sparkrun does not have a `host exec` subcommand — this command does not exist.

Three previous attempts to collect process data have been tried and abandoned:
1. **SSH directly from container** — removed due to security concerns (command injection surface)
2. **Local agent (127.0.0.1:8081)** — the Rust `sparkrun-local-agent` was never deployed to the cluster nodes
3. **`sparkrun host exec` (current)** — never worked because the command doesn't exist

Each attempt's failure is caught silently, so the user sees empty data with no visible error.

The monitor data from `sparkrun cluster monitor --json` already contains process information per host via `host_monitor.sh`. The `HostMetricsSchema` already has a `processes` field. The data is being collected by the streaming monitor — it's just not being used by the `processes` endpoint.

**Security impact:** NONE — no exploit path identified. The bug is a missing feature (a command that doesn't exist), not a vulnerability.

## TDD Fix Plan

### Cycle 1: Cover monitor metrics already contain process data

**RED**: Write a test that asserts `normalizeMonitorOutput` preserves the `processes` field from monitor tick data — proving the data is already flowing through the monitor stream.

**GREEN**: No code change needed if test passes (confirms the data path works).

**verify**: `pnpm test lib/rpc/procedures/monitor.test.ts`

### Cycle 2: Rewrite processes handler to use monitor snapshot instead of sparkrun host exec

**RED**: Write a test for the `processes` handler that passes when process data is returned from a one-shot monitor call, not a `sparkrun host exec` call.

**GREEN**: Replace the `processes` handler body — instead of iterating hosts and calling `sparkrun host exec`, use `runSparkrunJson` with `["cluster", "monitor", "--json", "--once"]` to get a single monitor tick, then extract the `processes` field from each host's metrics.

**verify**: `pnpm test lib/rpc/procedures/monitor.test.ts`

### Cycle 3: Fix the ps aux column parsing

**RED**: Write a test that asserts `normalizeProcessList` correctly parses a real `ps aux` format (with VSZ, RSS, TTY, STAT, START, TIME columns before COMMAND).

**GREEN**: Update the parser to skip the extra columns between MEM and COMMAND. The real `ps aux` has columns: USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND. The parser currently assumes USER PID %CPU %MEM COMMAND, so VSZ gets mistaken for COMMAND and parsing breaks.

**verify**: `pnpm test tests/processes.test.ts`

### REFACTOR

- Remove the duplicated `ProcessEntry` interface from `monitor.ts` — import from `processes.ts` instead
- The `allProcesses` variable in the removed SSH/local-agent code is no longer referenced; declare it fresh

## Acceptance Criteria

- [ ] `/rpc/monitor.processes` returns top 5 processes per host
- [ ] Processes are sorted by CPU usage descending
- [ ] All existing tests pass
- [ ] New tests cover the monitor-snapshot approach
- [ ] `normalizeProcessList` correctly parses real `ps aux` output with all columns
- [ ] No `sparkrun host exec` calls — only uses commands that exist

## Resolution

**Status:** Resolved
**Fixed:** 2026-08-07

### What changed

- Rewrote `processes` handler in `monitor.ts` to read one tick from `sparkrun cluster monitor --json` instead of calling non-existent `sparkrun host exec`
- Fixed `normalizeProcessList` in `processes.ts` to correctly parse real `ps aux` output (11 columns including VSZ, RSS, TTY, STAT, START, TIME) using heuristic detection (VSZ starts with digits → full format; otherwise short format)
- Fixed 11 failing tests in `client.test.ts`: added `vi` import, replaced ESM-incompatible `require()` with named import
- Removed empty `tests/process-list.test.ts` and stale `app/rpc-disabled/` directory
- Removed duplicated `ProcessEntry` interface and unused imports from `monitor.ts`

### Verification

- `npx vitest run`: 72 passed, 5 skipped, 11 test files
- `npx tsc --noEmit`: clean typecheck
- Test files: 11 passed (was 2 failed)
