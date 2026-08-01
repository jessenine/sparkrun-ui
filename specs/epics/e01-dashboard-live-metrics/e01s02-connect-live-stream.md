# Story s02: Connect to live metrics stream

**type:** feat  
**risk:** P1  
**context:** infra  
**Delta:** MODIFIED  
**Context:** Connects the dashboard to the live metrics stream via oRPC eventIterator to receive real-time updates every 2-3 seconds. This story modifies the `DashboardLive.tsx` component to add a new effect that streams monitor metrics and updates the aggregate stats component in real-time.

## Before

DashboardLive only uses `status.stream()` for cluster status updates. The `AggregateStats` component has its own `monitor.stream()` effect, but it was not being used due to the normalization bug. When the bug was present, metrics were empty and no updates occurred.

**Current behavior:** Dashboard shows aggregate stats with 0 values because metrics are not being received or processed correctly.

## After

DashboardLive now has a dedicated effect for `monitor.stream()` that receives metrics every 2-3 seconds and updates the `AggregateStats` component in real-time. The `AggregateStats` component correctly processes the metrics and displays updated values.

**New behavior:** Dashboard receives metrics updates every 2-3 seconds via oRPC eventIterator and updates the UI without page reload.

**Result:** Live-updating dashboard with real-time CPU, GPU, memory, power, and temperature metrics.

## Steps

1. Review existing `streamSparkrunNdjson` implementation in `lib/sparkrun.ts` → verify: `pnpm test lib/sparkrun.test.ts`  
2. Verify `monitor.stream` handler correctly yields normalized metrics → verify: `pnpm test lib/rpc/procedures/monitor.test.ts`  
3. Verify `AggregateStats` component receives live updates → verify: `pnpm dev && curl -s http://localhost:5678/dashboard | grep -E "CPU|GPU|Memory"`  

## Verification Script (Step-by-Step)

1. Start the development server: `pnpm dev`
2. Open browser to http://localhost:5678/dashboard
3. Verify that metrics update every 2-3 seconds without page reload
4. Check terminal output for `[monitor.stream]` debug logs showing continuous data flow

## Out of scope

- Adding new metric types beyond what sparkrun provides
- Historical metrics storage or aggregation
- Alerting when metrics exceed thresholds
- Configurable refresh rate (hardcoded to 2 seconds)

## Risks

- **P1:** If the stream connection fails, metrics stop updating but dashboard remains functional. Detect by `connected` badge showing "reconnecting…".
- **P1:** If the stream sends malformed data, UI may crash. Detect by `pnpm test` failing on stream error handling.
- **P2:** If the stream sends data too frequently, UI may lag. Detect by `pnpm dev` running slowly with high CPU usage.

## Allure

```yaml
severity: high
categories:
  - "Monitoring"
  - "Live Updates"
```

## Verification Evidence

- [ ] Terminal logs show `[monitor.stream]` with continuous data flow
- [ ] Dashboard shows metrics updating every 2-3 seconds
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
