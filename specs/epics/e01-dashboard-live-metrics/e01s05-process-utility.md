# e01s05 - Host metrics: Top 5 process utilization

**Story:** In the Host metrics section, would it be possible to show process utilization, like a top 5 summary of "ps aux"?

**User value:** High - users want to see which processes are consuming resources on their DGX hosts, similar to `top` or `htop` but summarized for quick inspection.

**Acceptance criteria:**
1. Each host's metrics card in the "Host metrics" section shows a "Top processes" section
2. Displays top 5 processes by CPU or memory usage (configurable toggle)
3. Shows: process name, CPU%, memory usage, PID
4. Clicking a process name opens a modal with full `ps aux` output for that process
5. Data refreshes at the same interval as host metrics (currently 2s)

**Technical notes:**
- Need to extend `sparkrun cluster monitor` to include per-process metrics or add a new RPC endpoint
- On the frontend, add a new component for process list (similar to `SparklineGraph`)
- Consider performance: avoid fetching full `ps aux` for every process on every host every 2s

**Dependencies:** None (can be done independently)

**Story points:** 5

**WSJF score:** (BV=8 + TC=2 + RR=3) / 5 = 2.8
