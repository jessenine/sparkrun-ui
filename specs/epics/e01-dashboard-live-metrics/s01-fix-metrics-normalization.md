# s01 - Fix metrics normalization

## story.yaml

```yaml
story_id: s01
epic_id: e01
title: Fix normalizeMonitorOutput to correctly extract and flatten sample metrics
bcps: 3
status: pending
tasks:
  - id: t01
    description: Add debug logging to normalizeMonitorOutput to trace input/output
    verify: pnpm dev && curl -s http://localhost:5678/api/debug-monitor
    status: pending
  - id: t02
    description: Fix normalizeMonitorOutput to correctly extract metrics from sample
    verify: pnpm test lib/rpc/procedures/monitor.test.ts
    status: pending
  - id: t03
    description: Verify metrics display correctly in dashboard
    verify: pnpm dev && verify-dashboard-metrics.sh
    status: pending
```

## Description

Fix the `normalizeMonitorOutput` function in `lib/rpc/procedures/monitor.ts` to correctly extract and flatten sample metrics from the `sparkrun cluster monitor --json` output format.

## Current Behavior

- Dashboard shows all metrics as 0
- ORPC response shows both hosts as empty: `{"192.168.1.22":{},"127.0.0.1":{}}`
- Even when one host has valid sample data

## Expected Behavior

- Dashboard displays real-time CPU, GPU, memory, power, and temperature metrics
- ORPC response shows populated host objects with metrics

## Acceptance Criteria

- [ ] `normalizeMonitorOutput` correctly extracts metrics from valid sample data
- [ ] Empty hosts (null sample) produce empty objects, not skip the host
- [ ] Dashboard shows real metrics for all hosts with valid data
- [ ] All existing tests pass

## Verification

```bash
# Run tests
pnpm test lib/rpc/procedures/monitor.test.ts

# Typecheck
pnpm typecheck

# Manual verification
pnpm dev
# Open http://localhost:5678/dashboard and verify metrics display
```
