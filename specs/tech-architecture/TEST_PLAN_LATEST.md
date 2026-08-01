# TEST_PLAN_LATEST.md

## Testing Strategy

### Test Levels

| Level | Coverage | Tools | Frequency |
|-------|----------|-------|-----------|
| Unit | Individual functions, schemas | vitest | On every commit |
| Integration | RPC endpoints, CLI interactions | vitest | On every commit |
| Component | React components, interactions | vitest + React Testing Library | On every commit |
| E2E | Full user flows | (none yet) | Pre-release |

### Test Taxonomy

#### Unit Tests

**Scope:** Pure functions, schema validation, helpers

**Files:** `lib/**/*.test.ts`

**Coverage Targets:**
- All schema validators (`lib/schemas.ts`)
- Helper functions (`lib/ansi.ts`, `lib/sparkrun.ts`, etc.)
- RPC procedure logic (where testable without Next.js)

**Example:**
```typescript
// lib/schemas.test.ts
test("WorkloadSchema validates valid workload", () => {
  const valid = {
    cluster_id: "default",
    job_id: "abc123",
    recipe: "llama-3-8b",
    host: "192.168.1.10",
    status: "running",
  };
  expect(WorkloadSchema.parse(valid)).toEqual(valid);
});
```

#### Integration Tests

**Scope:** RPC endpoints, CLI interactions, state readers

**Files:** `lib/**/*.test.ts` (integration tests intermixed)

**Coverage Targets:**
- oRPC procedures (`lib/rpc/procedures/*.ts`)
- sparkrun CLI spawning (`lib/sparkrun.ts`)
- Cache reading (`lib/state.ts`)

**Example:**
```typescript
// lib/sparkrun.test.ts
test("runSparkrunJson executes command and parses JSON", async () => {
  const result = await runSparkrunJson(["cluster", "status", "--json"]);
  expect(result).toHaveProperty("host_count");
});
```

#### Component Tests

**Scope:** React components, hooks, interactivity

**Files:** `app/**/*.test.tsx`

**Coverage Targets:**
- Client components (`app/components/**/*.tsx`)
- Hooks (`app/components/**/*.ts`)
- Page components (`app/**/page.tsx`)

**Example:**
```typescript
// app/components/dashboard/AggregateStats.test.tsx
test("AggregateStats renders metrics with healthy values", () => {
  const tick = { timestamp: 123, hosts: { "127.0.0.1": validHostMetrics } };
  render(<AggregateStats />);
  expect(screen.getByText(/CPU/)).toBeInTheDocument();
});
```

### Test Quality Standards (F.I.R.S.T)

| Criterion | Definition | Enforcement |
|-----------|------------|-------------|
| **Fast** | Tests complete in <100ms (unit) or <1s (integration) | CI timeout |
| **Independent** | No shared state between tests | Fresh module for each test |
| **Repeatable** | Same result in any environment | No flaky tests |
| **Self-Validating** | Assert on observable outcomes, not implementation | No manual inspection |
| **Timely** | Write tests before implementation (TDD) | RED-GREEN commits |

### Test Coverage Goals

| Area | Target |
|------|--------|
| Schema validation | 100% |
| Helper functions | 100% |
| RPC procedures | 100% |
| Component logic | 80% |
| UI rendering | Snapshot tests |

### Test Commands

| Action | Command |
|--------|---------|
| Run all tests | `pnpm test` |
| Watch mode | `pnpm test:watch` |
| Compatibility tests | `pnpm test:compat` |
| Coverage report | `pnpm test --coverage` |

### Test Data

**Fixtures:** `lib/__fixtures__/*`

- `cluster-default.json` — Default cluster definition
- `cluster-status.json` — Sample cluster status response
- `clusters.json` — List of configured clusters
- `monitor-stream.ndjson` — Sample monitor stream output
- `recipe-validate.json` — Recipe validation response
- `recipe-vram.json` — Recipe VRAM estimation response
- `recipes-list.json` — Sample recipes list response
- `version.txt` — Sample version string

### Known Gaps

- No E2E tests for full user flows
- No component snapshot tests for visual regression
- No load/stress tests for concurrent workloads

### Future Enhancements

- Playwright or Cypress for E2E testing
- Chromatic or Percy for visual regression
- Mocked cluster hosts for integration testing
