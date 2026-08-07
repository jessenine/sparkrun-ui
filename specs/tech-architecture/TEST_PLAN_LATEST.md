# Test Design: sparkrun-ui (Project-Wide)

> **Scope:** All modules in `lib/`, `app/components/`, `app/` pages, `app/rpc/` routes.
> **Epic coverage:** e01 (Dashboard Live Metrics), e02 (Launch Recipe Wizard), e03 (Recipes Browser), e04 (Cluster Monitor), e05 (Logs Tail), e06 (Chat Interface), e07 (Benchmarks).
> **Risk tiers:** P0=critical path, P1=high value, P2=expected, P3=nice to have.
> **Skill lineage:** `plan-tests` — bridges slicing and planning; this is the project-wide reference.

---

## 1. Risk Matrix & Scenarios

### 1.1 Core Schema Parsing

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P0-01 | Cluster status --json output parses as ClusterStatusSchema with all fields | P0 | Unit | lib/schemas.ts |
| SC-P0-02 | Recipe list --json output parses as RecipeListSchema with name/registry/runtime | P0 | Unit | lib/schemas.ts |
| SC-P0-03 | Cluster list --json outputs parse as ClusterEntrySchema array | P0 | Unit | lib/schemas.ts |
| SC-P0-04 | Monitor tick NDJSON parses as MonitorTickSchema per host, per line | P0 | Unit | lib/schemas.ts |
| SC-P1-05 | Recipe validate --json parses as RecipeValidateResultSchema | P1 | Unit | lib/schemas.ts |
| SC-P1-06 | Recipe vram --json shape: recipe, model, weights, total, fits_dgx_spark | P1 | Unit | lib/schemas.ts |
| SC-P2-07 | WorkloadStatusSchema parses workload health response | P2 | Unit | lib/schemas.ts |
| SC-P2-08 | Invalid/malformed JSON fixture gracefully rejects with parse error | P2 | Unit | lib/schemas.ts |

### 1.2 Normalize / Transform Functions

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P0-09 | normalizeMonitorOutput handles array format with valid sample data | P0 | Unit | lib/rpc/procedures/monitor.ts |
| SC-P0-10 | normalizeMonitorOutput handles flat record format (current UI expectation) | P0 | Unit | lib/rpc/procedures/monitor.ts |
| SC-P0-11 | normalizeMonitorOutput handles null sample (host with no data) | P0 | Unit | lib/rpc/procedures/monitor.ts |
| SC-P0-12 | normalizeMonitorOutput handles missing/undefined hosts gracefully | P0 | Unit | lib/rpc/procedures/monitor.ts |
| SC-P1-13 | normalizeMonitorOutput preserves processes array from sample data | P1 | Unit | lib/rpc/procedures/monitor.ts |
| SC-P1-14 | normalizeMonitorOutput parses processes string into array | P1 | Unit | lib/rpc/procedures/monitor.ts |

### 1.3 sparkrun CLI Spawning

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P0-15 | runSparkrun spawns sparkrun with correct args and returns stdout | P0 | Unit | lib/sparkrun.ts |
| SC-P0-16 | runSparkrunJson runs command and parses JSON output | P0 | Unit | lib/sparkrun.ts |
| SC-P1-17 | runSparkrun throws ORPCError on non-zero exit code | P1 | Unit | lib/sparkrun.ts |
| SC-P1-18 | runSparkrunStream handles streaming stdout line-by-line | P1 | Unit | lib/sparkrun.ts |
| SC-P2-19 | runSparkrun handles empty stdout gracefully | P2 | Unit | lib/sparkrun.ts |
| SC-P2-20 | runSparkrun aborts child process on signal | P2 | Unit | lib/sparkrun.ts |

### 1.4 Draft Lifecycle (Tempfile Management)

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P0-21 | writeDraft creates file in DRAFT_DIR with correct .yaml extension | P0 | Unit | lib/draft.ts |
| SC-P0-22 | writeDraft validates draftId (rejects invalid chars) | P0 | Unit | lib/draft.ts |
| SC-P1-23 | writeDraftMeta creates .meta.json file | P1 | Unit | lib/draft.ts |
| SC-P1-24 | readDraftMeta reads and parses .meta.json correctly | P1 | Unit | lib/draft.ts |
| SC-P1-25 | readDraftMeta returns null for missing/nonexistent draft | P1 | Unit | lib/draft.ts |
| SC-P1-26 | deleteDraft removes .yaml file, ignores missing files | P1 | Unit | lib/draft.ts |
| SC-P2-27 | ensureDir creates dir with 0o777 permissions (EACCES fix regression guard) | P2 | Unit | lib/draft.ts |
| SC-P2-28 | reapStale cleans draft files older than MAX_AGE_MS | P2 | Unit | lib/draft.ts |

### 1.5 Port Checking

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P1-29 | probePortsParallel returns correct inUse for reachable port | P1 | Unit | lib/portCheck.ts |
| SC-P1-30 | probePortsParallel returns false for unreachable port | P1 | Unit | lib/portCheck.ts |
| SC-P2-31 | probePortsParallel handles multiple host:port pairs with concurrency | P2 | Unit | lib/portCheck.ts |

### 1.6 RPC Procedures

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P0-32 | monitor.stream returns normalized monitor ticks via EventIterator | P0 | Integration | lib/rpc/procedures/monitor.ts |
| SC-P0-33 | monitor.processes returns process list from sparkrun host exec | P0 | Integration | lib/rpc/procedures/monitor.ts |
| SC-P0-34 | status.get returns cluster status from sparkrun cluster status | P0 | Integration | lib/rpc/procedures/status.ts |
| SC-P0-35 | status.stream returns status ticks via EventIterator | P0 | Integration | lib/rpc/procedures/status.ts |
| SC-P1-36 | recipes.list returns recipe list from sparkrun | P1 | Integration | lib/rpc/procedures/recipes.ts |
| SC-P1-37 | recipes.listExtended returns enriched recipe list | P1 | Integration | lib/rpc/procedures/recipes.ts |
| SC-P1-38 | recipes.listWithCategory returns recipes grouped by category | P1 | Integration | lib/rpc/procedures/recipes.ts |
| SC-P0-39 | recipes.readYaml returns raw YAML for named recipe | P0 | Integration | lib/rpc/procedures/recipes.ts |
| SC-P0-40 | recipes.validate validates YAML via writeDraft + sparkrun recipe validate | P0 | Integration | lib/rpc/procedures/recipes.ts |
| SC-P1-41 | recipes.show returns recipe metadata | P1 | Integration | lib/rpc/procedures/recipes.ts |
| SC-P1-42 | recipes.info returns recipe VRAM/estimate info | P1 | Integration | lib/rpc/procedures/recipes.ts |
| SC-P1-43 | recipes.dryRun runs validation pass only | P1 | Integration | lib/rpc/procedures/recipes.ts |
| SC-P2-44 | benchmarks.list returns benchmark history from sparkrun | P2 | Integration | lib/rpc/procedures/benchmarks.ts |
| SC-P2-45 | benchmarks.get returns single benchmark detail | P2 | Integration | lib/rpc/procedures/benchmarks.ts |
| SC-P2-46 | benchmarks.profiles returns benchmark profiles list | P2 | Integration | lib/rpc/procedures/benchmarks.ts |
| SC-P0-47 | run.start runs sparkrun run and returns result | P0 | Integration | lib/rpc/procedures/run.ts |
| SC-P1-48 | run.startStream runs sparkrun run and returns streaming logs | P1 | Integration | lib/rpc/procedures/run.ts |
| SC-P2-49 | clusters.list returns cluster list | P2 | Integration | lib/rpc/procedures/clusters.ts |
| SC-P2-50 | clusters.getDefault returns default cluster | P2 | Integration | lib/rpc/procedures/clusters.ts |
| SC-P2-51 | workloads.stop stops a running workload | P2 | Integration | lib/rpc/procedures/workloads.ts |
| SC-P2-52 | workloads.health returns workload health status | P2 | Integration | lib/rpc/procedures/workloads.ts |
| SC-P2-53 | logs.stream returns log lines via EventIterator | P2 | Integration | lib/rpc/procedures/logs.ts |
| SC-P2-54 | chat.stream returns chat response via EventIterator | P2 | Integration | lib/rpc/procedures/chat.ts |
| SC-P2-55 | update.stream returns update status via EventIterator | P2 | Integration | lib/rpc/procedures/update.ts |
| SC-P2-56 | disk.list returns disk usage information | P2 | Integration | lib/rpc/procedures/disk.ts |

### 1.7 RPC Agent Client

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P1-57 | Agent client routes process requests to host agent over TCP | P1 | Unit | lib/rpc/agent/client.ts |
| SC-P1-58 | Agent client detects and validates host agent version | P1 | Unit | lib/rpc/agent/client.ts |
| SC-P2-59 | Agent client returns processes from all hosts aggregated | P2 | Unit | lib/rpc/agent/client.ts |
| SC-P1-60 | Agent client handles connection errors gracefully (returns partial results) | P1 | Unit | lib/rpc/agent/client.ts |

### 1.8 Helper Modules (ANSI, State, WorkloadStatus)

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P0-61 | stripAnsi removes ANSI escape codes from log strings | P0 | Unit | lib/ansi.ts |
| SC-P1-62 | state.ts reads cache files and returns parsed state | P1 | Unit | lib/state.ts |
| SC-P1-63 | state.ts handles missing cache files gracefully (returns null/empty) | P1 | Unit | lib/state.ts |
| SC-P2-64 | workloadStatus.ts aggregates workload health from status data | P2 | Unit | lib/workloadStatus.ts |
| SC-P2-65 | runningRecipes.ts returns running recipes with correct schema | P2 | Unit | lib/runningRecipes.ts |
| SC-P2-66 | metrics-collector.ts collects and normalizes metrics from monitor ticks | P2 | Unit | lib/metrics-collector.ts |

### 1.9 Component Tests (React)

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P1-67 | AggregateStats renders CPU/GPU/memory/power metrics from NormalizedTick | P1 | Component | app/components/dashboard/AggregateStats.tsx |
| SC-P1-68 | SparklineGraph renders a sparkline for a metric time series | P1 | Component | app/components/dashboard/SparklineGraph.tsx |
| SC-P1-69 | DashboardLive renders and subscribes to monitor stream | P1 | Component | app/components/dashboard/DashboardLive.tsx |
| SC-P1-70 | ProcessList renders Top 5 processes per host | P1 | Component | app/components/dashboard/ProcessList.tsx |
| SC-P1-71 | WorkloadCard renders workload status with stop action | P1 | Component | app/components/dashboard/WorkloadCard.tsx |
| SC-P1-72 | LaunchWizard runs validate → readBackendInfo → launch sequence | P1 | Component | app/components/launch/LaunchWizard.tsx |
| SC-P1-73 | YamlEditor renders CodeMirror with YAML content and validates | P1 | Component | app/components/launch/YamlEditor.tsx |
| SC-P2-74 | IssueList renders validation issues with severity badges | P2 | Component | app/components/launch/IssueList.tsx |
| SC-P2-75 | LaunchProgressDialog shows progress during launch execution | P2 | Component | app/components/launch/LaunchProgressDialog.tsx |
| SC-P2-76 | OverridesForm allows editing recipe defaults | P2 | Component | app/components/launch/OverridesForm.tsx |
| SC-P1-77 | RecipesBrowser renders recipe catalog with search/filter | P1 | Component | app/components/recipes/RecipesBrowser.tsx |
| SC-P2-78 | RecipeShowDialog renders recipe details with launch action | P2 | Component | app/components/recipes/RecipeShowDialog.tsx |
| SC-P2-79 | RecipeInfoPopover shows VRAM estimate on hover | P2 | Component | app/components/recipes/RecipeInfoPopover.tsx |
| SC-P2-80 | LogStream renders ANSI-colored log lines in real-time | P2 | Component | app/components/logs/LogStream.tsx |
| SC-P2-81 | HostCard renders host with metric gauges | P2 | Component | app/components/monitor/HostCard.tsx |
| SC-P2-82 | MonitorLive renders all host cards with live updates | P2 | Component | app/components/monitor/MonitorLive.tsx |
| SC-P2-83 | ChatPage renders chat interface with message history | P2 | Component | app/components/chat/ChatPage.tsx |
| SC-P1-84 | HeaderStats shows cluster header with live summary values | P1 | Component | app/components/HeaderStats.tsx |
| SC-P2-85 | Nav renders navigation with active states | P2 | Component | app/components/Nav.tsx |
| SC-P2-86 | Shell renders layout with header/footer and page content | P2 | Component | app/components/Shell.tsx |
| SC-P2-87 | Toast renders and auto-dismisses notification toasts | P2 | Component | app/components/ui/Toast.tsx |

### 1.10 API / RPC Routes (Next.js Route Handlers)

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P1-88 | /rpc/[[...rest]] route handler delegates to ORPC and logs errors | P1 | Integration | app/rpc/[[...rest]]/route.ts |
| SC-P2-89 | /api/* routes respond correctly | P2 | Integration | app/api/*/route.ts |
| SC-P2-90 | /rpc-disabled route returns 200 with disabled fallback | P2 | Integration | app/rpc-disabled/[[...rest]]/route.ts |

### 1.11 Live CLI Compatibility Suite

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P1-91 | sparkrun --version succeeds | P1 | Integration | tests/sparkrun-compat.test.ts |
| SC-P1-92 | list --all --json output parsed by RecipeListSchema | P1 | Integration | tests/sparkrun-compat.test.ts |
| SC-P1-93 | cluster status --json output parsed by ClusterStatusSchema | P1 | Integration | tests/sparkrun-compat.test.ts |
| SC-P1-94 | cluster list --json output parsed by ClusterEntrySchema | P1 | Integration | tests/sparkrun-compat.test.ts |
| SC-P1-95 | recipe vram --json has expected fields | P1 | Integration | tests/sparkrun-compat.test.ts |

### 1.12 End-to-End (UI User Flows)

| Scenario ID | Behavior Description | Risk | Test Level | Target File/Module |
|-------------|----------------------|------|------------|--------------------|
| SC-P0-96 | Dashboard loads and shows live metrics from cluster | P0 | E2E | N/A (Playwright) |
| SC-P0-97 | Recipes browser loads and displays recipe catalog | P0 | E2E | N/A (Playwright) |
| SC-P0-98 | Launch a recipe via URL: /launch?recipe=@official/... | P0 | E2E | N/A (Playwright) |
| SC-P1-99 | Edit recipe YAML and revalidate before launch | P1 | E2E | N/A (Playwright) |
| SC-P1-100 | View running process list on dashboard | P1 | E2E | N/A (Playwright) |
| SC-P1-101 | View benchmark list and detail | P1 | E2E | N/A (Playwright) |
| SC-P2-102 | Chat with a running model | P2 | E2E | N/A (Playwright) |
| SC-P2-103 | Stream live logs for a running workload | P2 | E2E | N/A (Playwright) |

---

## 2. Test Level Strategy

| Level | Scope | Tools | Where | Coverage Target |
|-------|-------|-------|-------|-----------------|
| **Unit** | Pure functions, schema validation, helpers, normalization | vitest | `lib/**/*.test.ts` | 100% for schemas, helpers; 90% overall lib/ |
| **Integration** | RPC procedures (mock sparkrun), state readers, port check | vitest | `lib/**/*.test.ts` | 95% for RPC handlers |
| **Component** | React components with mocked RPC/data | vitest + React Testing Library | `app/**/*.test.tsx` | 80% for client components |
| **Live compat** | Actual sparkrun CLI output against schemas (gated) | vitest | `tests/sparkrun-compat.test.ts` | All schema scenarios |
| **E2E** | Full user flows in browser | Playwright | `e2e/` (planned) | Critical paths only |

### 2.1 Push-Down Principle

Tests SHALL default to the lowest possible level:
- Parse logic → Unit (no sparkrun needed, use fixtures)
- Data transformation → Unit (no sparkrun needed)
- RPC handler logic → Integration (mock `runSparkrun` return)
- React rendering logic → Component test (mock RPC calls)
- Cross-cutting user flow → E2E (Playwright with live container)

### 2.2 Risk Tiers (P0-P3)

| Tier | Definition | Required Test Level | Response to Failure |
|------|------------|-------------------|---------------------|
| **P0** | Core functionality; whole system unusable if broken | Unit + Integration + E2E (eventually) | Block release; immediate fix |
| **P1** | High-value feature with no alternative path | Unit + Integration | Must fix before next release |
| **P2** | Expected behavior; workaround exists | Unit or Integration | Log bug, schedule for next sprint |
| **P3** | Nice-to-have / cosmetic | Unit (if trivial) | No action required |

---

## 3. Fixture Architecture & Isolation

### 3.1 JSON Fixtures (Static)

Located at `lib/__fixtures__/` — used by schema tests to assert real sparkrun CLI output shapes.

| Fixture | Source | Schema |
|---------|--------|--------|
| `cluster-default.json` | `sparkrun cluster list --json` (default cluster entry) | `rawCluster` |
| `cluster-status.json` | `sparkrun cluster status --json` | `ClusterStatusSchema` |
| `clusters.json` | `sparkrun cluster list --json` | `z.array(rawCluster)` |
| `monitor-stream.ndjson` | `sparkrun cluster monitor --json` (live capture) | `MonitorTickSchema` |
| `recipe-validate.json` | `sparkrun recipe validate <path> --json` | `RecipeValidateResultSchema` |
| `recipe-vram.json` | `sparkrun recipe vram <name> --json` | Inline parse check |
| `recipes-list.json` | `sparkrun list --all --json` | `RecipeListSchema` |
| `version.txt` | `sparkrun --version` | Inline parse check |

### 3.2 Mock Strategy for RPC Tests

RPC procedure tests that call `runSparkrunJson` or `runSparkrun` SHALL:

1. **Import the full module** and use `vi.mock` to intercept `runSparkrunJson` at the vitest module level
2. **Return fixture data** matching the sparkrun CLI JSON shape for the command under test
3. **Test error paths** by making `runSparkrunJson` throw or return unexpected data

```
lib/rpc/procedures/recipes.test.ts  →  vi.mock("@/lib/sparkrun")
```

### 3.3 Component Test Isolation

Component tests SHALL:

1. Mock the ORPC client module: `vi.mock("@/lib/rpc/client")` to return controlled data
2. Not require a running sparkrun or Docker container
3. Use the `.tsx` extension and `<ComponentName>.test.tsx` naming

```
app/components/dashboard/AggregateStats.test.tsx  →  vi.mock("@/lib/rpc/client")
```

### 3.4 Live Compat Suite Guard

The `tests/sparkrun-compat.test.ts` suite SHALL:

1. Gate on `sparkrun --version` exit code (skip if not installed)
2. Gate on `RUN_LIVE_TESTS=1` or `SPARKRUN_LIVE=1` environment variable
3. Run only against the host `sparkrun` CLI — no mocking
4. Use `describe.skip` when sparkrun is not installed

---

## 4. NFR Verification

| NFR Type | Requirement | Verification Command | Risk |
|----------|-------------|---------------------|------|
| **Performance** | Metrics refresh in 2-3 seconds | `pnpm test -- --timeout 5000 tests/perf/metrics-response.test.ts` | P1 |
| **Performance** | One-shot RPCs < 100ms | `pnpm test -- --timeout 2000 tests/perf/rpc-latency.test.ts` | P2 |
| **Performance** | Log tail < 1s latency | Manual check with live cluster | P2 |
| **Reliability** | sparkrun CLI exit code 0 passes; non-zero throws ORPCError | Unit test (SC-P1-17, SC-P1-18) | P1 |
| **Security** | No auth bypass; SSH keys read-only bind mount | Code review / security-review skill | P0 |
| **Security** | No secrets in draft files (draft dir is /tmp) | Code inspection in `lib/draft.ts` | P2 |
| **Resilience** | Server 500 errors handled gracefully in UI toast | Component test with error mock | P1 |
| **Resilience** | Draft files cleaned after 30min (reapStale) | Unit test (SC-P2-28) | P2 |

---

## 5. Out of Scope

- Automated performance/load testing (benchmarking framework not yet established)
- Cross-browser compatibility testing (Playwright CI not yet set up)
- Mobile responsive layout testing
- Visual regression (snapshot) tests — deferred until component library stabilizes
- API contract tests with third-party services (no external APIs consumed)
- Accessibility audit automation (manual review only currently)

---

## 6. Implementation Roadmap

| Phase | Priority | Scenarios | Effort | Depends On |
|-------|----------|-----------|--------|------------|
| **Phase 1 — Core lib coverage** | High | SC-P0-01 to SC-P0-16, SC-P0-21 to SC-P0-22 | 2-3 days | None (fixtures exist) |
| **Phase 2 — Draft + Port + Error handlers** | High | SC-P1-17 to SC-P1-30 | 1-2 days | Phase 1 |
| **Phase 3 — RPC integration tests (mocked)** | High | SC-P0-32 to SC-P0-47, SC-P1-36 to SC-P1-48 | 3-4 days | Phase 1 |
| **Phase 4 — Component tests** | Medium | SC-P1-67 to SC-P1-87 | 3-4 days | Phase 3 (prevents drift) |
| **Phase 5 — Live compat suite** | Medium | SC-P1-91 to SC-P1-95 | 0.5 days | None (exists already) |
| **Phase 6 — Remaining RPCs** | Low | SC-P2-44 to SC-P2-56 | 1-2 days | Phase 3 |
| **Phase 7 — E2E (Playwright)** | Low | SC-P0-96 to SC-P0-98, SC-P1-99 to SC-P1-101 | 3-5 days | Stable container |
| **Phase 8 — Remaining helpers + components** | Low | SC-P2-57 to SC-P2-66, remainder | 2-3 days | Phases 1-4 |

**Total estimated effort:** 15-24 days spread across phases (high-priority phases 1-3: 6-9 days)

---

## 7. Current Test Coverage Summary

| Area | Tests | Scenarios Covered | Gaps |
|------|-------|-------------------|------|
| Schema parsing | `lib/schemas.test.ts` (6 tests) | SC-P0-01 to SC-P0-06, SC-P0-08 (partial) | SC-P0-07, SC-P2-08 |
| Monitor normalization | `lib/rpc/procedures/monitor.test.ts` (10 tests) | SC-P0-09 to SC-P1-14 | None significant |
| ANSI stripping | `lib/ansi.test.ts` | SC-P0-61 | None |
| Port checking | `lib/portCheck.test.ts` | SC-P1-29 to SC-P1-30 | SC-P2-31 |
| Agent client | `lib/rpc/agent/client.test.ts` | SC-P1-57 to SC-P1-60 | None significant |
| Chat procedures | `lib/rpc/procedures/chat.test.ts` | SC-P2-54 | None |
| Recipes procedures | `lib/rpc/procedures/recipes.test.ts` | SC-P1-36 to SC-P1-43 (partial) | See coverage below |
| Running recipes | `lib/runningRecipes.test.ts` | SC-P2-65 | None |
| Process list | `lib/sparkrun.test.ts` | SC-P0-15 to SC-P0-16, SC-P1-17 | SC-P1-18, SC-P2-19 to SC-P2-20 |
| Live compat suite | `tests/sparkrun-compat.test.ts` | SC-P1-91 to SC-P1-95 | None (gated) |
| Workload status | `tests/processes.test.ts` | SC-P2-52 (partial) | Needs expansion |
| Draft lifecycle | **Missing** | None | SC-P0-21 to SC-P2-28 completely uncovered |
| Component tests | **Missing** | None | All component scenarios |
| E2E tests | **Missing** | None | All E2E scenarios |
| Remaining RPCs | **Missing** | None | SC-P2-44 to SC-P2-56 |
| Helper modules (state, workloadStatus, metrics-collector) | **Missing** | None | SC-P1-62 to SC-P2-66 |

---

## 8. Scenario-to-Test Mapping (Existing Tests)

| Test File | Scenarios Covered |
|-----------|-------------------|
| `lib/schemas.test.ts` | SC-P0-01, SC-P0-02, SC-P0-03, SC-P0-04, SC-P1-05, SC-P1-06, SC-P0-08 (partial) |
| `lib/rpc/procedures/monitor.test.ts` | SC-P0-09, SC-P0-10, SC-P0-11, SC-P0-12, SC-P1-13, SC-P1-14 |
| `lib/ansi.test.ts` | SC-P0-61 |
| `lib/portCheck.test.ts` | SC-P1-29, SC-P1-30 |
| `lib/rpc/agent/client.test.ts` | SC-P1-57, SC-P1-58, SC-P1-59, SC-P1-60 |
| `lib/rpc/procedures/chat.test.ts` | SC-P2-54 |
| `lib/rpc/procedures/recipes.test.ts` | SC-P1-36, SC-P1-37, SC-P1-38, SC-P1-39, SC-P1-40, SC-P1-41, SC-P1-42, SC-P1-43 |
| `lib/runningRecipes.test.ts` | SC-P2-65 |
| `lib/sparkrun.test.ts` | SC-P0-15, SC-P0-16, SC-P1-17 |
| `tests/sparkrun-compat.test.ts` | SC-P1-91, SC-P1-92, SC-P1-93, SC-P1-94, SC-P1-95 |
| `tests/processes.test.ts` | SC-P2-52 (partial) |
