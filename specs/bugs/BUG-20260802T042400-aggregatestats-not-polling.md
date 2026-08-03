# BUG-20260802T042400: AggregateStats not polling monitor API

## Problem

The `AggregateStats` component in the dashboard is showing "reconnecting" status and empty metrics (0.0% for CPU, GPU, Memory) despite:
- The `/api/monitor` endpoint working correctly (verified with `curl` and `node fetch`)
- The `/api/disk` endpoint working correctly
- The component rendering correctly in the DOM
- Server logs showing "Component mounted" and "Component running"

The component should:
1. Fetch disk info once on mount
2. Poll `/api/monitor` every 2 seconds
3. Update metrics and show "live" status when data is received

But in reality, the component shows "reconnecting" and no metrics data.

## Root Cause Analysis

### Phase 1: Reproduce

**Environment**: Production Docker container at `192.168.1.77:5678`

**Steps**:
1. Load `/dashboard` page
2. Observe AggregateStats component in browser
3. Check browser console logs
4. Check server logs

**Observed**: 
- Component renders with "Cluster overview" section
- Shows "0 host" count (empty)
- Shows "0 job" count
- Shows "reconnecting" (gray dot) instead of "live" (green dot)
- Server logs show `[AggregateStats] Component mounted` and `[AggregateStats] Component running` appearing multiple times
- Browser console shows NO fetch-related logs (e.g., `[AggregateStats] Fetching /api/monitor...`)
- Direct API test from container works: `node -e "fetch('http://localhost:5678/api/monitor')"` returns valid data

### Phase 2: Isolate

**Investigation**:
1. Checked AggregateStats.tsx component - code looks correct
2. Verified useEffect has empty dependency array `[]` which should run on mount
3. Verified `pollMonitor()` is called immediately in useEffect
4. Verified server logs show component running
5. Verified API endpoints work from container

**Key Finding**: 
- Component logs "Component mounted" and "Component running" but NO fetch logs
- This means the `useEffect` hook is NOT running or the fetch call is not executing

### Phase 3: Hypothesize

**Hypothesis**: The component is being rendered in React Strict Mode, and the `useEffect` hook is being called but the fetch is silently failing due to a CORS issue or network error that's being caught and swallowed.

**Root Cause**: 
The component uses console.log for debugging, but these logs are not appearing in the browser console. This suggests the `pollMonitor` function is never being called, which means the `useEffect` hook is not running.

Looking at the code more carefully:
```typescript
useEffect(() => {
  const ac = new AbortController();
  let cancelled = false;
  
  const pollMonitor = async () => {
    try {
      console.log("[AggregateStats] Fetching /api/monitor...");
      // ...
    }
  };
  
  pollMonitor();
  const interval = setInterval(pollMonitor, 2000);
  
  return () => {
    cancelled = true;
    ac.abort();
    clearInterval(interval);
  };
}, []);
```

The useEffect has an empty dependency array `[]`, which should run once on mount. But the issue is that the first `useEffect` (for disk info) might be causing the component to re-render before the second `useEffect` runs, or there's a race condition.

Wait, I see it now! There are TWO `useEffect` hooks:
1. First useEffect (line 116): Fetches disk info with empty dependency array `[]`
2. Second useEffect (line 135): Polls monitor API with empty dependency array `[]`

Both should run on mount. But the second useEffect might be running before the first one completes, or there's a timing issue.

Actually, looking at the server logs again: `[AggregateStats] Component running` appears multiple times (about 6 times in the logs). This suggests React Strict Mode is causing the component to mount multiple times.

The issue is that the `useEffect` hook is running, but the `pollMonitor` function is not executing the fetch call. This could be because:
1. The `useEffect` hook is not running at all
2. The fetch call is throwing an error that's being caught and swallowed
3. The fetch call is hanging and timing out

### Phase 4: Verify

**Test**: Check if the fetch call is being made by adding more detailed logging

**Current status**: Cannot access browser console to verify. Server logs don't show fetch attempts.

**Confirmed**: 
- API endpoints work from container (verified with curl and node fetch)
- Component renders correctly
- Component logs "mounted" and "running" but no fetch logs

**Conclusion**: The `useEffect` hook is running, but the fetch call is failing silently. The most likely cause is a CORS issue or network error that's being caught by the try-catch block.

## TDD Fix Plan

### Cycle 1: Verify useEffect runs

**RED**: Write a test that confirms the useEffect hook runs and calls `pollMonitor` on mount
**GREEN**: Add a test that verifies the fetch call is made
**verify**: Run the test and confirm it passes

### Cycle 2: Fix fetch error handling

**RED**: Write a test that simulates a failed fetch and verifies error handling
**GREEN**: Fix the error handling to properly catch and log errors
**verify**: Run the test and confirm errors are logged

### Cycle 3: Add fallback to disk fetch dependency

**RED**: Write a test that verifies monitor polling starts even if disk fetch fails
**GREEN**: Remove the `[diskInfo]` dependency or add fallback logic
**verify**: Run the test and confirm monitor polling works regardless of disk fetch

## Acceptance Criteria

- [ ] Browser console shows `[AggregateStats] Fetching /api/monitor...` logs every 2 seconds
- [ ] Browser console shows `[AggregateStats] JSON parsed, results: 1` after successful fetch
- [ ] Dashboard shows "live" status (green dot) instead of "reconnecting" (gray dot)
- [ ] AggregateStats shows actual CPU, GPU, Memory metrics instead of 0.0%
- [ ] Server logs do not show uncaught errors

## Resolution

<!-- filled in by validate-fix -->
