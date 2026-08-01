# s04 - Individual metric graphs per host

**Title:** Individual metric graphs per host

**Business Value:** 8 (Significant user value - users need to see trends and patterns, not just current values)

**Time Criticality:** 3 (Flexible - nice to have, can slip one sprint)

**Risk Reduction:** 5 (Moderate - enables better monitoring and troubleshooting)

**Job Size:** 5 (1 week - requires chart component, data aggregation, and integration)

**WSJF:** (8 + 3 + 5) / 5 = **3.6**

## Current behavior

Dashboard shows aggregate stats (averages) for CPU, GPU, memory, power, and temperature across all hosts. Users can only see current values, not trends over time.

## Expected behavior

Dashboard displays sparkline/line graphs showing historical trends for each metric type (CPU usage, GPU utilization, memory usage, power draw, temperature) for each host in the cluster overview. Users can see patterns and anomalies.

## Acceptance criteria

- [ ] Each host in the cluster overview shows sparkline graphs for CPU usage, GPU utilization, memory usage, power draw, and temperature
- [ ] Graphs show at least 30 seconds of historical data with 2-second intervals
- [ ] Graph scales auto-adjust to show min/max values for the displayed time window
- [ ] Graphs update live with each metrics refresh (every 2-3 seconds)
- [ ] Graphs are visually distinct (different colors) and labeled clearly
- [ ] No regression in existing aggregate stats display

## Implementation notes

- Use a lightweight chart library (e.g., react-easy-chart or similar)
- Store last N data points per metric per host in React state
- Graphs should be scrollable if there are many hosts
- Consider adding a toggle to show/hide individual metric graphs

## Verification

```bash
pnpm test
pnpm typecheck
```

Manual: Open dashboard, verify sparkline graphs appear for each host and update live.
