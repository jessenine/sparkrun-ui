# DESIGN_PLAN_LATEST.md

## Design Principles

### 1. Sparkrun as Backend

**Principle:** The sparkrun CLI is the single source of truth.

**Implications:**
- UI never manages clusters directly; always delegate to sparkrun
- Cache reads are for enrichment only; never for authoritative state
- Long-running mutations (benchmarks) fire-and-forget

### 2. Live Data First

**Principle:** Dashboard reflects real-time cluster state.

**Implications:**
- Metrics refresh every 2-3 seconds via oRPC eventIterator
- Logs stream live via sparkrun's JSON output
- Workload list always shows current sparkrun cluster status

### 3. Client-Side Filtering

**Principle:** Filter recipes and workloads in the browser.

**Implications:**
- Recipe lists loaded once, then filtered client-side
- No pagination for lists under 100 items
- Search is immediate (no debounce delay)

### 4. Fail Gracefully

**Principle:** UI remains usable even when sparkrun is unavailable.

**Implications:**
- Empty states for missing data (not "error" states)
- Retry logic for transient failures
- Cache data persists across reloads (via sparkrun cache)

## Component Design

### Dashboard

```
Dashboard
├── AggregateStats (top metrics)
│   ├── CPU Usage
│   ├── GPU Usage
│   ├── Memory
│   ├── Disk
│   ├── Power
│   └── Temps
├── WorkloadList (grid of WorkloadCard)
└── UpdateSparkrunButton (top-right)
```

### Launch Wizard

```
LaunchWizard
├── Step 1: RecipeSelection
│   └── RecipesBrowser (filtered list)
├── Step 2: ConfigPreview
│   └── YamlEditor (CodeMirror 6 with validation)
├── Step 3: Preview
│   └── CommandPreview (sparkrun launch command)
└── Step 4: Launch
    └── LaunchProgressDialog (spinner + log tail)
```

### Monitor

```
MonitorLive
├── HostList (grid of HostCard)
│   ├── HostCard
│   │   ├── HostHeader (hostname, status)
│   │   ├── CpuMeter
│   │   ├── GpuMeter
│   │   ├── MemoryMeter
│   │   ├── PowerMeter
│   │   ├── CpuTempMeter
│   │   └── GpuTempMeter
└── Auto-refresh (2s interval)
```

## RPC Design

### Endpoint Patterns

**One-shot (GET-like):**
```typescript
export const status = os.output(ClusterStatusSchema).handler(fetchStatus);
```

**Streaming (eventIterator):**
```typescript
export const stream = os
  .input(z.object({ intervalSec: z.number().int().min(1) }).optional())
  .output(eventIterator(TickSchema))
  .handler(async function* ({ input, signal }) { ... });
```

**Mutation (POST-like):**
```typescript
export const launch = os
  .input(LaunchRequestSchema)
  .output(LaunchResponseSchema)
  .handler(async ({ input }) => { ... });
```

### Error Handling

- oRPC errors propagate to client
- UI shows error state (not thrown exception)
- Retry logic for transient failures (network, sparkrun unavailable)

## State Management

### React State

- **Local state:** Component-specific (form inputs, modals)
- **Server state:** React Query equivalent (via oRPC client caching)
- **Cache state:** sparkrun cache readers (lib/state.ts)

### Cache Structure

```
~/.cache/sparkrun/
├── jobs/           # Current running workloads
├── benchmarks/     # Benchmark history
└── registries/     # Recipe registry cache
```

## Performance Goals

| Metric | Target |
|--------|--------|
| Dashboard load | <1s |
| Recipe list load | <500ms |
| Metrics refresh | 2-3s |
| Log tail latency | <1s |
| Recipe filter (100 items) | <50ms |

## Accessibility

- Semantic HTML for all components
- ARIA labels for interactive elements
- Keyboard navigation for lists and forms
- High contrast mode support (Tailwind dark mode)

## Responsive Design

- Dashboard: 3-column grid on mobile, 5-column on desktop
- Launch wizard: Single column on mobile, multi-step on desktop
- Monitor: 2-column grid on mobile, 4-column on desktop

## Future Design Considerations

- Dark mode (already supported via Tailwind)
- Multiple cluster support
- User preferences storage
- Exportable reports (benchmarks, logs)
- Custom dashboards (widget layout)
