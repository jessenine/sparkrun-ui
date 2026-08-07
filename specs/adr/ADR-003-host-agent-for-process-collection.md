# ADR-003: Host Agent for Process Collection

**Status:** Accepted  
**Date:** 2026-08-07  
**Epic:** e01 — Dashboard Live Metrics  
**Story:** e01s05 — Process Utility  

## Context

The dashboard needs to display per-host top-N processes sorted by CPU usage. Two approaches were tried:

1. **Run `sparkrun cluster monitor --json` from inside the Docker container** — fails because `sparkrun` needs SSH access to cluster nodes, and SSH host keys are not configured inside the container.

2. **Run `sparkrun` from the host** — the host (DGX Spark node) has proper SSH key access to the cluster. The `sparkrun-local-agent` binary runs on the host and exposes an HTTP endpoint on port 8081.

## Decision

The RPC handler (`monitor.processes` in `lib/rpc/procedures/monitor.ts`) uses a **two-tier fallback strategy**:

1. **Primary:** Try `sparkrun cluster monitor --json --interval 1` (works when SSH is configured inside the container or in development environments)
2. **Fallback:** If no tick is received, query the host agent at `http://127.0.0.1:8081/processes` (works in production where the agent runs on the host)

The host agent pattern is the **production path** for this deployment.

## Consequences

### Positive
- The UI always gets process data — either from the monitor stream or the host agent
- No SSH key management inside the Docker container
- The host agent can serve other data sources in the future

### Negative
- The host agent is an **undeclared dependency** — it must be running on port 8081
- The agent binary must be maintained separately from the UI repository
- If the agent is down, the process list falls back to empty

## Agent Protocol

The host agent exposes:

```
GET /processes → { timestamp, processes: [{ user, pid, cpu, mem, command }] }
GET /health    → { status, timestamp, agent_id, uptime_seconds }
GET /metrics   → { timestamp, uptime_seconds, process_count, agent_id }
```

The agent runs on **each host node** that reports to the sparkrun cluster monitor.

## Future Work

- Document the agent binary location and startup procedure in a RUNBOOK.md
- Add a health check for the agent to the dashboard (show warning if agent unreachable)
- Consider containerizing the agent with host network access
