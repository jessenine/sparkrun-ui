# Story s01: Fix metrics normalization

**type:** fix  
**risk:** P0  
**context:** infra  
**Delta:** MODIFIED  
**Context:** Fixes the `normalizeMonitorOutput` function in `lib/rpc/procedures/monitor.ts` to correctly extract and flatten sample metrics from the `sparkrun cluster monitor --json` output format. This story modifies existing code that currently returns empty metrics for all hosts.

## Before

`normalizeMonitorOutput` receives data from `sparkrun cluster monitor --json` in format:
```json
{
  "timestamp": 1234567890,
  "hosts": [
    {"host": "192.168.1.22", "error": null, "sample": null, ...},
    {"host": "127.0.0.1", "error": null, "sample": {"cpu_usage_pct": "45", ...}}
  ]
}
```

**Current behavior:** When `sample` is `null`, the function returns an empty object for that host. However, when `sample` is `undefined`, the function also returns an empty object. The issue is that the function doesn't correctly handle the case where the entire `hosts` array contains objects with `sample: null` values for some hosts.

**Result:** Dashboard shows all metrics as 0 because the normalized output has empty host objects.

## After

`normalizeMonitorOutput` now correctly:
1. Handles `null` samples by returning an empty object `{}` (intentional behavior to preserve host in output)
2. Handles valid `sample` objects by flattening them to top level
3. Logs debug information to trace the data flow

**New behavior:** When `sample` is valid, metrics are correctly extracted and flattened. When `sample` is `null`, an empty object is returned (preserving the host key).

**Result:** Dashboard displays real-time CPU, GPU, memory, power, and temperature metrics per host.

## Steps

1. Add debug logging to `normalizeMonitorOutput` to trace input/output data → verify: `pnpm dev && curl -s http://localhost:5678/api/debug-monitor | grep -E "normalizeMonitorOutput|normalized"`  
2. Verify `normalizeMonitorOutput` correctly extracts metrics from valid sample data → verify: `pnpm test lib/rpc/procedures/monitor.test.ts`  
3. Verify metrics display correctly in dashboard → verify: `pnpm dev && curl -s http://localhost:5678/dashboard | grep -E "CPU|GPU|Memory|Power" | head -4`  

## Verification Script (Step-by-Step)

1. Start the development server: `pnpm dev`
2. Open browser to http://localhost:5678/dashboard
3. Verify that CPU, GPU, Memory, Power, and Temperature values are not all 0
4. Check terminal output for `[normalizeMonitorOutput]` debug logs showing non-empty host data

## Out of scope

- Changing the ORPC streaming mechanism
- Adding new metric types beyond what sparkrun provides
- Historical metrics storage or aggregation
- Alerting when metrics exceed thresholds

## Risks

- **P0:** If the fix doesn't resolve the issue, metrics remain 0. Detect by checking terminal logs for `[normalizeMonitorOutput]` showing empty objects.
- **P0:** If the fix breaks existing functionality, dashboard shows no data. Detect by `pnpm test` failing.
- **P1:** If debug logging is too verbose, it may affect performance. Detect by `pnpm dev` running slowly.

## Allure

```yaml
severity: critical
categories:
  - "Monitoring"
  - "Fix"
```

## Verification Evidence

- [ ] Terminal logs show `[normalizeMonitorOutput]` with non-empty host data
- [ ] Dashboard shows non-zero values for CPU, GPU, Memory, Power, Temperature
- [ ] `pnpm test` passes
- [ ] `pnpm typecheck` passes
