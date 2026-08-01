# Story s03: Aggregate stats display

**type:** feat  
**risk:** P1  
**context:** ui  
**Delta:** MODIFIED  
**Context:** Updates the `AggregateStats` component to correctly display aggregated metrics from the normalized host metrics data. This story modifies the `aggregate` function and `AggregateStats` component to properly calculate and display averages across all hosts.

## Before

The `AggregateStats` component receives metrics from `monitor.stream()` but all values are 0 due to the normalization bug. The `aggregate` function correctly sums values but receives empty/zero data.

**Current behavior:** Dashboard shows aggregate stats with all values at 0 regardless of actual host metrics.

## After

The `AggregateStats` component receives properly normalized metrics from `monitor.stream()` and correctly calculates averages across all hosts. The `aggregate` function properly sums and divides values to produce meaningful averages.

**New behavior:** Dashboard shows real averages for CPU, GPU, memory, power, and temperatures across all hosts.

**Result:** Aggregate stats display real values that update every 2-3 seconds.

## Steps

1. Review `AggregateStats` component metric aggregation logic → verify: `pnpm test app/components/dashboard/AggregateStats.test.tsx`  
2. Verify `num()` function handles empty values correctly → verify: `pnpm test app/components/dashboard/AggregateStats.test.tsx`  
3. Verify dashboard shows real averages for all metrics → verify: `pnpm dev && curl -s http://localhost:5678/dashboard | grep -E "CPU|GPU|Memory|Power" | head -4`  

## Verification Script (Step-by-Step)

1. Start the development server: `pnpm dev`
2. Open browser to http://localhost:5678/dashboard
3. Verify that aggregate stats show non-zero values for CPU, GPU, Memory, Power, Temperature
4. Check that values update every 2-3 seconds

## Out of scope

- Adding new metric types beyond what sparkrun provides
- Historical metrics storage or aggregation
- Alerting when metrics exceed thresholds
- Per-host detailed metrics (shown in separate component)

## Risks

- **P1:** If the `aggregate` function has a calculation bug, averages may be incorrect. Detect by comparing dashboard values with `sparkrun cluster monitor` CLI output.
- **P1:** If host count is 0, division by zero may occur. Detect by `pnpm test` failing on edge case.
- **P2:** If some hosts have missing metrics, averages may be skewed. Detect by comparing with CLI output.

## Allure

```yaml
severity: high
categories:
  - "Monitoring"
  - "UI"
```

## Verification Evidence

- [ ] Dashboard shows non-zero values for all aggregate metrics
- [ ] Values update every 2-3 seconds
- [ ] `pnpm test app/components/dashboard/AggregateStats.test.tsx` passes
- [ ] `pnpm typecheck` passes
