# s03 - Aggregate stats display

## story.yaml

```yaml
story_id: s03
epic_id: e01
title: Aggregate stats display shows correct values from normalized metrics
bcps: 3
status: pending
tasks:
  - id: t01
    description: Review AggregateStats component metric aggregation logic
    verify: pnpm test app/components/dashboard/AggregateStats.test.tsx
    status: pending
  - id: t02
    description: Verify num() function handles empty values correctly
    verify: pnpm test app/components/dashboard/AggregateStats.test.tsx
    status: pending
  - id: t03
    description: Manual verification of dashboard metrics display
    verify: pnpm dev && verify-dashboard-metrics.sh
    status: pending
```

## Description

Update the AggregateStats component to correctly display aggregated metrics from the normalized host metrics data.

## Acceptance Criteria

- [ ] Dashboard shows real averages for CPU, GPU, memory, power, temperatures
- [ ] Empty metrics are handled correctly (show 0 or dash)
- [ ] Stats update in real-time with new metrics

## Verification

```bash
# Run tests
pnpm test app/components/dashboard/AggregateStats.test.tsx

# Manual verification
pnpm dev
# Open http://localhost:5678/dashboard and verify aggregate stats display
```
