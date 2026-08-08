# Traceability Matrix — jix-sparkrun-ui

Date: 2026-08-07
Release branch: `feat/add-missing-tests`
Method: coverage run `npx vitest run --coverage` (istanbul), overall **80.07% statements**.
Tests: **355 passed / 5 skipped** across 62 test files. Typecheck: **clean**.

This matrix maps source modules → their Vitest suite → measured statement
coverage, and links the tracked stories (`SC-P0-*` / `SC-P1-*`) to the artifacts
that satisfy them. It is the traceability input for the `gate-trace` quality gate.

## 1. Component coverage (app/components)

| Source | Test file | Stmts |
|--------|-----------|-------|
| AnimatedBackground.tsx | AnimatedBackground.test.tsx | 98% |
| benchmarks/BenchmarkCharts.tsx | benchmarks/BenchmarkCharts.test.tsx | 84% |
| benchmarks/BenchmarkDetail.tsx | benchmarks/BenchmarkDetail.test.tsx | 70% |
| benchmarks/BenchmarksList.tsx | benchmarks/BenchmarksList.test.tsx | 100% |
| benchmarks/NewBenchmarkForm.tsx | benchmarks/NewBenchmarkForm.test.tsx | 79% |
| chat/ChatPage.tsx | chat/ChatPage.test.tsx | 82% |
| dashboard/AggregateStats.tsx | dashboard/AggregateStats.test.tsx | 87% |
| dashboard/DashboardLive.tsx | dashboard/DashboardLive.test.tsx | 90% |
| dashboard/ProcessList.tsx | dashboard/ProcessList.test.tsx | 94% |
| dashboard/SparklineGraph.tsx | dashboard/SparklineGraph.test.tsx | 100% |
| dashboard/UpdateSparkrunButton.tsx | dashboard/UpdateSparkrunButton.test.tsx | 74% |
| dashboard/WorkloadCard.tsx | dashboard/WorkloadCard.test.tsx | 85% |
| launch/IssueList.tsx | launch/IssueList.test.tsx | 100% |
| launch/LaunchProgressDialog.tsx | launch/LaunchProgressDialog.test.tsx | 80% |
| launch/LaunchWizard.tsx | launch/LaunchWizard.test.tsx | 88% |
| launch/OverridesForm.tsx | launch/OverridesForm.test.tsx | 91% |
| launch/YamlEditor.tsx | launch/YamlEditor.test.tsx | 86% |
| logs/LogStream.tsx | logs/LogStream.test.tsx | 83% |
| monitor/HostCard.tsx | monitor/HostCard.test.tsx | 62% |
| monitor/MonitorLive.tsx | monitor/MonitorLive.test.tsx | 89% |
| recipes/RecipeInfoPopover.tsx | recipes/RecipeInfoPopover.test.tsx | 88% |
| recipes/RecipeShowDialog.tsx | recipes/RecipeShowDialog.test.tsx | 90% |
| recipes/RecipesBrowser.tsx | recipes/RecipesBrowser.test.tsx | 82% |
| ui/Button.tsx | ui/Button.test.tsx | 100% |
| ui/Textarea.tsx | ui/Textarea.test.tsx | 100% |
| ui/primitives (Card/Field/Badge/Switch/…) | ui/primitives.test.tsx | 100% |
| Footer / HeaderStats / Nav / Shell | *.test.tsx | 100/85/82/100% |
| useWorkloadHealth.ts | useWorkloadHealth.test.tsx | covered |

## 2. Library / RPC coverage (lib)

| Source | Test file | Stmts |
|--------|-----------|-------|
| draft.ts | draft.test.ts | 100% |
| state.ts | state.test.ts | 94% |
| portCheck.ts | portCheck.test.ts | 100% |
| workloadStatus.ts | workloadStatus.test.ts | 100% |
| metrics-collector.ts | metrics-collector.test.ts | 96% |
| ansi.ts | ansi.test.ts | 99% |
| cn.ts | cn.test.ts | 100% |
| runningRecipes.ts | runningRecipes.test.ts | 100% |
| schemas.ts | schemas.test.ts | covered |
| rpc/router.ts | rpc/router.test.ts | 100% |
| rpc/agent/client.ts | rpc/agent/client.test.ts | 64% |
| rpc/procedures/benchmarks.ts | rpc/procedures/benchmarks.test.ts | 73% |
| rpc/procedures/chat.ts | rpc/procedures/chat.test.ts | 93% |
| rpc/procedures/clusters.ts | rpc/procedures/clusters.test.ts | 100% |
| rpc/procedures/disk.ts | rpc/procedures/disk.test.ts | 78% |
| rpc/procedures/helpers.ts | rpc/procedures/helpers.test.ts | 100% |
| rpc/procedures/logs.ts | rpc/procedures/logs.test.ts | 93% |
| rpc/procedures/monitor.ts | rpc/procedures/monitor*.test.ts | 90% |
| rpc/procedures/processes.ts | covered via router/monitor | 97% |
| rpc/procedures/recipes.ts | rpc/procedures/recipes*.test.ts | 72% |
| rpc/procedures/run.ts | rpc/procedures/run.test.ts | 95% |
| rpc/procedures/status.ts | rpc/procedures/status.test.ts | 96% |
| rpc/procedures/update.ts | rpc/procedures/update.test.ts | 100% |
| rpc/procedures/workloads.ts | rpc/procedures/workloads.test.ts | 94% |
| sparkrun.ts | sparkrun.test.ts (executor: 8%, see §4) | 8% |

**Overall statements: 80.07%** (2226/2780); lines 83.07%; functions 79.53%;
branches 69.61%.

## 3. Story → test artifact mapping

| Story | Covered by |
|-------|------------|
| SC-P0-21/22 draft lifecycle | lib/draft.test.ts |
| SC-P0-32/33 monitor RPC | lib/rpc/procedures/monitor*.test.ts |
| SC-P0-34 status→jobs | lib/rpc/procedures/status.test.ts |
| SC-P0-39/40 recipes RPC schemas | lib/rpc/procedures/recipes*.test.ts |
| SC-P0-47 run args | lib/rpc/procedures/run.test.ts |
| SC-P1-29/30 port probing | lib/portCheck.test.ts |
| Dashboard live metrics (e01s01–e01s05) | dashboard/DashboardLive/AggregateStats/SparklineGraph/WorkloadCard/ProcessList + UpdateSparkrunButton tests |

## 4. Known gaps (non-blocking)

- **lib/sparkrun.ts (8%)** — the CLI executor. Deliberately thin per
  `CLAUDE.md`/docs: it loads `node:child_process` via `createRequire` +
  `Function`-constructor to defeat the NFT tracer, which bypasses `vi.mock`.
  Covered indirectly through every procedure test that calls
  `runSparkrun*`/`streamSparkrunLines`. Not unit-testable directly; documented
  and accepted.
- Lower statement files: agent/client.ts (64%), HostCard.tsx (62%), Select.tsx
  (39%), Toast.tsx (40%) — candidate follow-up work beyond the gate.
- E2E (Playwright) not yet started (test plan Phase 8).

## 5. Gate verdict

All three release gates now satisfied:
1. **Coverage ≥ 80% statements** — 80.07% ✅
2. **Security review** — `specs/security/REVIEW.md` (PASS) ✅
3. **Traceability matrix** — this file ✅
Typecheck clean; full suite green; all commits Conventional Commits.
