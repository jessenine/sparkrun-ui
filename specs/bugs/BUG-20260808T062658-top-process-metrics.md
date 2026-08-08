# BUG-20260808T062658: Top-process metrics broken (CPU always 0, MEM is MB not %)

## Problem

The "Top Processes" table (used by `ProcessList`, fed from `rpc.monitor.processes`)
shows a set of different process rows, but the metrics are broken:

- **Actual behavior:** CPU% is `0.0` for every listed process. The only non-zero
  value is the MEM column for `systemd`, which consistently reads `13.3`. All
  other processes report `0.0` for both CPU% and MEM%.
- **Expected behavior:** Each row shows a real CPU usage percentage (and harder
  also find a real MEM value) for that process, so the list is meaningfully
  sorted by CPU and reflects actual load.

**Security impact: NONE** — no exploit path identified. This is a data-quality /
measurement bug in the local monitoring agent, not a vulnerability.

## Root Cause Analysis

The Top-processes data is produced by the **local Rust agent**
(`sparkrun-local-agent`). In the deployed environment `sparkrun` (inside the
container) cannot SSH to the cluster, so the `monitor.processes` RPC handler
(`lib/rpc/procedures/monitor.ts`) falls back to the host-local agent at
`http://127.0.0.1:8081/processes`. That fallback returns the agent's
`ProcessList` verbatim, so the broken measurements come straight from the agent's
process collector. This is confirmed by the symptom itself: sparkrun's own
per-host `sample.processes` would carry real CPU values; a CPU of `0` for every
row can only come from the agent fallback.

Two code-verified defects live in the agent's collection path
(`collect_processes` → `read_proc_files` → `read_single_process` in
`agent/sparkrun-local-agent/src/main.rs`):

1. **CPU is hardcoded to `0.0`.** In `read_single_process` the value is pinned
   with `let cpu: f32 = 0.0; // Would need to track previous readings` (line 172).
   No per-process CPU sampling or delta-tracking is ever performed, so every
   returned `cpu` field is `0`. This is the definitive reason CPU% is `0` for all
   rows.

2. **MEM is reported in MB, not a percentage.** The value is computed as
   `let mem: f32 = (rss * 4096.0 / 1_000_000.0) // MB approximation` (line 173) —
   `rss` from `/proc/[pid]/statm` (in pages) × 4096 bytes ÷ 1e6 = **megabytes**.
   The UI column (`ProcessList.tsx`) is labelled `MEM%` and renders
   `p.mem.toFixed(1)`. So a process with ~13 MB RSS displays "13.3", which reads as
   a bogus percentage. This is a units/contract mismatch between the agent and the
   UI.

The observation that **only `systemd` shows a non-zero value in the field** is
not fully code-verified: the current code attempts `/proc/<pid>/stat` + `/proc/<pid>/statm`
for every numeric PID, and the parsing gate is permissive enough that any readable
process should yield an entry. The "only systemd" observation most likely stems
from the **deployed runtime** (e.g. restricted `/proc` read access inside the
container so that only PID 1 is readable, and/or a stale deployed agent build).
Treat this specific aspect as an environment effect; the two code defects above
are independent of it and are certain.

**Contributing factors / history:** This is a recurrence/related follow-on to the
"process list always empty" bug family (BUG-20260807T062700 and subsequent host-agent
fix). Those bugs added the agent fallback; that fallback now returns data, but the
data itself is measured incorrectly.

**Risk level:** Medium — data-integrity / observability defect. Not a crash or
security issue, but it undermines the dashboard's core purpose.

## TDD Fix Plan

### Cycle 1: CPU must be computed, not hardcoded (RED/GREEN at the agent unit level)

- **RED:** Add a unit test asserting that a `ProcessEntry` produced by the
  collection logic carries a `cpu >= 0.0` value that is *not* pinned to zero when
  real sample data is fed in — e.g. expose a helper `compute_cpu_percent(sample,
  previous)` with a known delta and assert the correct percentage.
  `agent/sparkrun-local-agent` — `cargo test`.
- **GREEN:** Implement a per-process CPU sampler: read `utime`+`stime` from
  `/proc/<pid>/stat` in two consecutive samples separated by the agent's
  `interval_ms`, compute the delta as a fraction of `(elapsed * clock_ticks_per_sec)`,
  and surface it as the process's CPU%. Replace the hardcoded `0.0`. Keep `/proc`
  read-only (no shell execution).
- **verify:** `cargo test` (agent), and for a live check run the agent and curl
  `/processes`.

### Cycle 2: MEM must be a percentage of total system memory (RED/GREEN)

- **RED:** Add a unit test asserting that `mem` is a fraction of total memory
  (e.g. `< 100.0` and equals `rss_bytes / total_bytes * 100` for a known input),
  not a raw MB figure.
- **GREEN:** Compute `mem` as `(rss_bytes / total_memory_bytes) * 100`. Obtain
  total memory via an existing safe API (`sysinfo` is already a dependency) once
  at startup and pass it through. Guard against a zero total (default to `0.0`).
- **verify:** `cargo test` (agent).

### Cycle 3: Stabilize process enumeration across the runtime (environment hardening)

- **RED:** Add a test that the collector tolerates partial `/proc` read failures
  (skips unreadable PIDs) and still returns whatever it could parse, without
  erroring wholesale.
- **GREEN:** Ensure `read_single_process` treats any per-PID read failure as
  "skip this PID" (it already returns `Option`); normalize the comm-parsing so
  comm-with-spaces is handled consistently. Confirm the agent is (re)built and
  redeployed to the node after Cycles 1–2.
- **verify:** `cargo test`; deploy the rebuilt binary and re-observe the UI.

### REFACTOR

- Move the `cpu`, `mem` computation out of `read_single_process` into small,
  pure, unit-testable helpers (e.g. `compute_cpu_percent`, `compute_mem_percent`).
- Add real Rust unit tests in `src/tests.rs` (or a new module) covering both
  helpers with known inputs, so the fix is durable against future refactors.
- Consider updating `lib.rs::collect_processes_safe` (currently a placeholder) to
  delegate to the same helpers, so the library and binary tests share one path.

## Acceptance Criteria

- [ ] CPU% is non-zero and reflects real per-interval CPU usage for idle/active processes
- [ ] MEM column shows a percentage (0–100) of total system memory, not raw MB
- [ ] The agent `/processes` response carries correct `cpu` and `mem` values
- [ ] `cargo test` (agent) passes — new unit tests for both helpers
- [ ] Existing UI test suite for `ProcessList`/`monitor.processes` still passes
- [ ] Top-processes sorted by CPU shows a meaningful, changing order under load

## Resolution

<!-- filled in by validate-fix -->
