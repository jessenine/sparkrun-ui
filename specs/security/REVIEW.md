# Security Review — jix-sparkrun-ui

Date: 2026-08-07
Branch: `feat/add-missing-tests`
Scope: application + RPC server layers (`app/`, `lib/`). Local dev-tool UI and
local ORPC RPC layer for driving the `sparkrun` CLI and the local
`sparkrun-local-agent`.

## Summary

No critical (CVSS 9–10) or high-severity findings in scope. The codebase has a
deliberately thin security surface: it is a local single-user tool that shells
out to a trusted local binary. Command-injection and path-traversal surfaces are
guarded. Merge gate: **PASS**, with three non-blocking hardening
recommendations recorded below.

## Methodology

Static review of every `spawn`/`exec`/`eval`/`Function`-constructor call-site,
every filesystem write driven by RPC input, secret handling, and the HTTP client
to the local agent. Focused on: injection, path traversal, SSRF, deserialization,
auth, and secrets.

## Findings

### 1. Command injection — LOW
Every subprocess launch goes through `runSparkrun`/`runSparkrunJson`/
`streamSparkrunLines`, which call `spawn(bin, args, opts)` with **argument
arrays and no `shell: true`** (`lib/sparkrun.ts`). Cluster IDs, recipe names,
paths, and host strings travel only as individual argv elements — never through
a shell. The `clusters.ts`/`run.ts` failure modes leak stderr/stdout into error
messages but do not execute it.

`lib/rpc/procedures/disk.ts:66` uses `exec()` on a **fully static literal**
(`"df -B1 --output=target,size,used,avail,pcent 2>/dev/null"`) with no
interpolation — no injection surface.

The `new Function("cp","bin","args","opts", "return cp.spawn(...)")` in
`lib/sparkrun.ts:14` is a Turbopack NFT tracing workaround. Its arguments are a
static `require` of `node:child_process` plus argv; it **never evaluates user
input**. Not exploitable, but flagged for reviewers (see recommendation R1).

### 2. Path traversal — LOW
All filesystem writes from RPC input go through `lib/draft.ts`. Both `writeDraft`
and `writeDraftMeta` call `safeId(draftId)`, which rejects anything not matching
`/^[a-zA-Z0-9_-]+$/` **before** the value is joined under `DRAFT_DIR`
(`lib/draft.ts:17`). ORPC input schemas re-validate `draftId` with the same
regex (`lib/rpc/procedures/run.ts`, `recipes.ts`). No `../` escape is possible.

### 3. SSRF via agent client — MEDIUM (by design), bounded
`lib/rpc/agent/client.ts` builds agent URLs from the environment or a `host`
argument: `http://${host}:8081`. The default is loopback
(`http://127.0.0.1:8081`). If a `host` value ever originates from untrusted
input this becomes SSRF. Currently `host` flows from server-side cluster host
lists (the operator's own config). Agent responses are shape-checked
(`Array.isArray(result.processes)`).

### 4. Deserialization — LOW
`runSparkrunJson` does `JSON.parse(r.stdout) as T` (`lib/sparkrun.ts:82`).
Output originates from the trusted local `sparkrun` binary, not an attacker.
`recipes.validate` additionally validates with a zod schema
(`RecipeValidateResultSchema.parse`). No `__proto__`-style prototype-pollution
inputs observed from local stdout.

### 5. Auth — NONE (informational)
This is a local single-user tool with no user accounts and no secrets. The only
`process.env` reads are `SPARKRUN_BIN`, `SPARKRUN_AGENT_URL`, `PORT`,
`NODE_ENV`. Communication with the local agent uses an `X-Agent-Request:
sparkrun-ui` header that asserts intent but is **not** authentication (the agent
endpoint on 127.0.0.1 has no token).

### 6. Remote code execution — NONE
No `eval`, `vm`, or `Function` call executes user-controlled source. See Finding 1.

## Recommendations (non-blocking)

- **R1**: Document the `new Function` spawn wrapper in a comment and add a lint
  guard so future edits don't widen it to user input.
- **R2**: If `SPARKRUN_AGENT_URL` or the agent port is ever exposed beyond
  loopback, add a shared-secret/token to `/health`, `/metrics`, `/processes` and
  uphold it in `lib/rpc/agent/client.ts`.
- **R3**: Schema-validate the payloads of the remaining `runSparkrunJson` call
  sites (only `recipes` currently parses with a zod schema) to harden against a
  malformed local binary response.

## Verification

- Security surface traced end-to-end across `lib/sparkrun.ts`,
  `lib/draft.ts`, `lib/rpc/procedures/*`, and `lib/rpc/agent/client.ts`.
- Existing unit tests cover `lib/sparkrun.ts`, `lib/draft.ts`, and the RPC
  procedure error/exit paths (see traceability matrix).
- No secrets, tokens, or credentials present in the repository.

Status: **PASS** (no blocking findings).
