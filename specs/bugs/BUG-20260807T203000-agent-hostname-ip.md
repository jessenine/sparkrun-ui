# BUG-20260807T203000: Local agent does not report its IP; Hostname/IP not displayed

## Problem

**Actual behavior:** The local agent (`sparkrun-local-agent`) reports only the machine `hostname` (surfaced solely in the `/processes` response). It never gathers or exposes the **IP address** of the machine it is running on. The web UI therefore has no way to display the local machine's Hostname/IP.

**Expected behavior:** The local agent gathers both the hostname and the IP address of the host it runs on, exposes them (e.g., in its HTTP responses), and the UI displays the Hostname/IP of the local machine.

**How to reproduce:** Query the agent process endpoint (`GET http://127.0.0.1:8081/processes`) — the JSON response contains `timestamp`, `processes`, `agent_id`, and `hostname`, but no IP field. The Cluster monitor page shows host cards and the agent process data, but no IP anywhere.

**Security impact:** NONE — gathering and displaying the local machine's hostname and IP exposes self-referential host metadata that is already reachable via the existing process/health endpoints. No privilege boundary is crossed and no exploit path is introduced.

## Prior history

`specs/bugs/registry.yaml` references a related fix — "Process list empty in deployed dashboard — `--hosts` flag kills process data" (BUG-20260807T101500) — which established the host-local agent as the fallback source for process data in deployed environments (sparkrun inside the container can't SSH). The registry row points at a bug-file that is not present in `specs/bugs/`; the agent's role as the local data source is confirmed by the live code (the agent HTTP client and the process fallback). This request is **related but novel** — it extends the agent contract (identity fields) rather than fixing process collection.

## Root Cause Analysis

The local agent is a small HTTP server exposing `/`, `/health`, `/metrics`, and `/processes`. Its data model reflects the machine identity in only one place:

- **Hostname** IS gathered (via the `hostname` crate) and attached to the process-collection result, which is returned by the `/processes` handler. It is also the fallback value used when collection fails.
- **IP address** is NOT gathered anywhere. There is no field, no helper, and no endpoint that captures the machine's IP, so the agent contract simply has no IP to offer.

The browser-facing side mirrors this gap:
- The agent client maps the process response into a typed object that includes `hostname` but has no IP field.
- The Cluster monitor host cards render a hostname (from cluster monitor per-host data) and GPU name, but there is no source of an IP and no place where the local agent's Hostname/IP is surfaced.

Contributing factors: the agent's identity information is spread thinly across its response types rather than being a single "node identity" value, and no dependency or helper for enumerating the local interface/IP is present. Because the agent runs on the local node outside the container, it is the authoritative source for that node's hostname and IP, but it is not currently providing the IP.

**Risk level: Low.** The change is additive (new optional-to-defaulted field + a display element), touches only the agent contract and one UI surface, and does not alter process/metrics semantics.

## TDD Fix Plan

1. **RED** — Agent: a Rust test asserting that the process-collection result includes a non-empty `ip_address` (or the `"unknown"` fallback when no interface can be determined).
   **GREEN** — Add an `ip_address` field to the process-collection result type, add a `get_local_ip()` helper, and populate the field in collection/fallback paths.
   **verify**: `cd agent/sparkrun-local-agent && cargo test`

   > IP-gathering options (documented, not finalized): (a) dependency-free — bind a UDP socket to an ephemeral port, `connect()` to a fixed non-routable/remote address, then read `local_addr()` to discover the egress interface IP (UDP connect does not transmit; safe on Linux); or (b) add the `local-ip-address` crate for interface enumeration that survives multi-homed setups. Prefer whichever survives your deployment; both must fall back to `"unknown"` when no address resolves.

2. **RED** — Agent: a Rust test asserting the health/info response includes both `hostname` and `ip_address`.
   **GREEN** — Extend the health (or add an `/info`) response type + handler to include hostname + IP, sharing the same retrieval helper as cycle 1.
   **verify**: `cd agent/sparkrun-local-agent && cargo test`

3. **RED** — Client: a test that the agent client's process-list mapping exposes `ip_address` alongside `hostname`.
   **GREEN** — Add `ip_address` to the client's typed response interface and let it flow through existing functions.
   **verify**: `npx vitest run lib/rpc/agent`

4. **RED** — UI: a component test asserting the monitor surface renders the local agent's Hostname/IP (e.g., `hostname (ip)`) when agent identity is available, and degrades gracefully when the agent is unreachable.
   **GREEN** — Fetch agent identity via the agent client and render a Hostname/IP indicator on the Cluster monitor page (top-level, since the agent describes the local node, not per-cluster-host cards).
   **verify**: `npx vitest run app/components/monitor`

**REFACTOR** — Consolidate hostname/IP retrieval into a single agent-identity helper/struct shared across process-collection and health/info responses; standardize the `"unknown"` fallback so the UI and tests treat absence consistently.

## Acceptance Criteria

- [ ] Agent exposes the local machine's `ip_address` (and hostname) in its HTTP responses
- [ ] Agent IP reporting falls back to `"unknown"` instead of failing when no interface resolves
- [ ] UI displays the local agent's Hostname/IP on the Cluster monitor surface
- [ ] UI degrades gracefully (no crash) when the agent is unreachable
- [ ] All new tests pass (`cargo test` for the agent, `vitest` for client/UI)
- [ ] Existing tests still pass

## Resolution

<!-- filled in by validate-fix -->
