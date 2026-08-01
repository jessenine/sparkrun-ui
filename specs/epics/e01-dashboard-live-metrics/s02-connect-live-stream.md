# s02 - Connect to live metrics stream

## story.yaml

```yaml
story_id: s02
epic_id: e01
title: Connect dashboard to live metrics stream via oRPC
bcps: 5
status: pending
tasks:
  - id: t01
    description: Review existing streamSparkrunNdjson implementation
    verify: pnpm test lib/sparkrun.test.ts
    status: pending
  - id: t02
    description: Ensure eventIterator correctly handles async iterator
    verify: pnpm test lib/rpc/procedures/monitor.test.ts
    status: pending
  - id: t03
    description: Verify dashboard receives live updates every 2-3 seconds
    verify: pnpm dev && verify-live-updates.sh
    status: pending
```

## Description

Connect the dashboard to the live metrics stream via oRPC eventIterator to receive real-time updates every 2-3 seconds.

## Acceptance Criteria

- [ ] Dashboard receives updates every 2-3 seconds
- [ ] Metrics refresh without page reload
- [ ] Error handling for stream disconnections

## Verification

```bash
# Run tests
pnpm test lib/rpc/procedures/monitor.test.ts

# Manual verification
pnpm dev
# Open http://localhost:5678/dashboard and verify live-updating metrics
```
