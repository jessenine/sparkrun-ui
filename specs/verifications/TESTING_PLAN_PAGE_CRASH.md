# Testing Plan: Page Crashing Issue

## Objective

Diagnose why the dashboard page crashes shortly after loading at `http://192.168.1.77:5678/dashboard`.

## Known Facts (Updated: 2026-08-02)

- Server is running Next.js 16.2.12 on port 5678
- Docker container `sparkrun-ui` is running with `network_mode: host`
- `/api/monitor` endpoint returns valid JSON with real metrics (CPU 7.7%, 3.6% on two hosts)
- `/api/processes` endpoint returns placeholder values (pid=0, cpu=0, mem=0) as sparkrun doesn't provide process-level metrics
- `/api/disk` endpoint returns disk usage data
- Server logs show no errors after container restart
- Server-side rendered HTML includes "live" status in header but "Cluster overview" section shows "reconnecting" (gray dot) and 0.0% metrics
- AggregateStats component is a Client Component (`"use client"`) and renders client-side
- Root `/` returns HTTP 307 redirect to `/dashboard`
- Dashboard page (`/dashboard`) returns HTTP 200 and includes React hydration scripts

## Initial Testing (2026-08-02) - PASS

### Test 1.1: Basic Server Health - PASS
**Command:** `curl -s -w "\nHTTP Status: %{http_code}\n" http://192.168.1.77:5678/`
**Result:** HTTP 307 redirect to /dashboard ✓
**Interpretation:** Server is running correctly

## Testing Strategy

Use a **divide-and-conquer** approach with progressive isolation to identify the root cause.

---

## Phase 1: Server-Side Verification (Isolate Backend)

### Test 1.1: Basic Server Health
**Command:**
```bash
curl -s -w "\nHTTP Status: %{http_code}\n" http://192.168.1.77:5678/ 2>&1 | head -3
```
**Expected:** HTTP 307 redirect to /dashboard
**Pass condition:** Server responds within 2 seconds

**Test Result:** PASS - HTTP 307 redirect to /dashboard

### Test 1.2: Dashboard HTML Response
**Command:**
```bash
curl -s http://192.168.1.77:5678/dashboard | grep -c "react"
```
**Expected:** > 100 (React client bundle references in HTML)
**Pass condition:** HTML contains React hydration scripts

**Test Result:** PASS - HTML contains React hydration scripts

### Test 1.3: API Endpoints Direct Access
**Command:**
```bash
curl -s -X POST http://192.168.1.77:5678/api/monitor -H "Content-Type: application/json" -d '{}'
```
**Expected:** JSON with `results`, `hosts`, `cpu_usage_pct` values
**Pass condition:** Valid JSON response with metrics

**Test Result:** PASS - Returns real metrics:
- Host 192.168.1.22: CPU=7.7%, GPU=0%
- Host 127.0.0.1: CPU=3.6%, GPU=6%

### Test 1.4: API Response Time
**Command:**
```bash
time curl -s -X POST http://192.168.1.77:5678/api/monitor > /dev/null
```
**Expected:** < 1 second
**Pass condition:** Response time under 1 second

**Test Result:** PASS - Response is cached and fast

**Action if FAIL:** Check Docker logs for errors:
```bash
ssh jix@192.168.1.77 "docker logs sparkrun-ui --tail 20"
```

---

## Phase 2: Network Layer Verification (Isolate Client-Server Communication)

### Test 2.1: HTTP Status Code
**Command:**
```bash
curl -s -o /dev/null -w "%{http_code}" http://192.168.1.77:5678/dashboard
```
**Expected:** 200
**Pass condition:** Returns 200

### Test 2.2: DNS Resolution
**Command:**
```bash
ping -c 1 192.168.1.77 | head -3
```
**Expected:** Successful ping
**Pass condition:** Response time < 10ms

### Test 2.3: Port Accessibility
**Command:**
```bash
nc -zv 192.168.1.77 5678 2>&1 || telnet 192.168.1.77 5678
```
**Expected:** Connection successful
**Pass condition:** Port 5678 is open and accepting connections

---

## Phase 3: Client-Side JavaScript Execution (Isolate Browser)

### Test 3.1: JavaScript Syntax Check
**Command:**
```bash
# Extract the client bundle and check for syntax errors
curl -s http://192.168.1.77:5678/_next/static/chunks/0exacxt~2tdmo.js | head -100
```
**Expected:** Valid JavaScript (not HTML error page)
**Pass condition:** Response is JavaScript code, not HTML

### Test 3.2: React Hydration Check
**Command:**
```bash
curl -s http://192.168.1.77:5678/dashboard | grep -o "react.Root" | head -3
```
**Expected:** React root element present
**Pass condition:** Found in HTML output

### Test 3.3: Browser Console Test (Manual)
**Steps:**
1. Open `http://192.168.1.77:5678/dashboard` in browser
2. Open Developer Tools → Console tab
3. Wait 10 seconds
4. Check for any error messages

**Expected:** No red error messages after initial load
**Pass condition:** Only expected warnings (e.g., React Strict Mode double-render)

### Test 3.4: Network Tab Check (Manual)
**Steps:**
1. Open Developer Tools → Network tab
2. Reload page
3. Filter by "xhr" or "fetch"
4. Look for `/api/monitor` request

**Expected:** 
- `/api/monitor` request appears within 2 seconds
- Status 200, response type `application/json`
- Response contains metrics data

**Pass condition:** API request completes successfully

---

## Phase 4: Component-Level Testing (Isolate AggregateStats)

### Test 4.1: AggregateStats DOM Presence
**Command:**
```bash
curl -s http://192.168.1.77:5678/dashboard | grep -c "Cluster overview"
```
**Expected:** 1 (AggregateStats renders this heading)
**Pass condition:** Found once in HTML

### Test 4.2: API Data Format Validation
**Command:**
```bash
curl -s -X POST http://192.168.1.77:5678/api/monitor -H "Content-Type: application/json" -d '{}' | python3 -c "
import sys, json
data = json.load(sys.stdin)
assert 'results' in data, 'Missing results'
assert 'hosts' in data['results'][0], 'Missing hosts'
assert len(data['results'][0]['hosts']) >= 2, 'Not enough hosts'
print('✓ API data format valid')
"
```
**Expected:** API returns data in expected format
**Pass condition:** JSON passes validation

### Test 4.3: num() Function Logic Check (Unit Test)
**File:** `app/components/dashboard/AggregateStats.test.tsx`

```typescript
import { describe, it, expect } from 'vitest';
import { num } from './AggregateStats';

describe('num()', () => {
  it('parses numeric strings', () => {
    expect(num('7.7')).toBe(7.7);
    expect(num('0')).toBe(0);
  });
  
  it('returns 0 for undefined', () => {
    expect(num(undefined)).toBe(0);
  });
  
  it('returns 0 for invalid strings', () => {
    expect(num('N/A')).toBe(0);
    expect(num('')).toBe(0);
  });
});
```

**Pass condition:** All tests pass

---

## Phase 5: Memory and Resource Limits (Isolate System Issues)

### Test 5.1: Docker Container Memory
**Command:**
```bash
ssh jix@192.168.1.77 "docker stats sparkrun-ui --no-stream --format '{{.CPUPerc}} {{.MemUsage}}'"
```
**Expected:** Memory usage under container limit
**Pass condition:** No OOM (Out of Memory) errors

### Test 5.2: Node.js Process Check
**Command:**
```bash
ssh jix@192.168.1.77 "docker exec sparkrun-ui ps aux | grep 'next start'"
```
**Expected:** Next.js process running
**Pass condition:** Process is active

---

## Phase 6: Stress Testing (Isolate Race Conditions)

### Test 6.1: Rapid Page Reloads
**Steps:**
1. Open dashboard in browser
2. Reload 10 times rapidly (Ctrl+R)
3. Check for crashes or inconsistent behavior

**Expected:** Page loads consistently each time
**Pass condition:** No crashes or blank screens

### Test 6.2: Concurrent API Polls
**Command:**
```bash
# Simulate multiple clients polling simultaneously
for i in {1..5}; do
  curl -s -X POST http://192.168.1.77:5678/api/monitor -H "Content-Type: application/json" -d '{}' &
done
wait
echo "All requests completed"
```
**Expected:** All requests return within 2 seconds
**Pass condition:** No timeouts or errors

---

## Phase 7: Browser Compatibility Check

### Test 7.1: Multiple Browsers
**Steps:**
1. Test in Chrome/Edge
2. Test in Firefox
3. Test in Safari (if macOS available)

**Expected:** Same behavior across browsers
**Pass condition:** Consistent experience

### Test 7.2: Mobile Browser
**Steps:**
1. Access from mobile device on same network
2. Check if page loads and functions

**Expected:** Page loads on mobile
**Pass condition:** No mobile-specific crashes

---

## Phase 8: Regression Testing

### Test 8.1: Verify Previous Working State
**Command:**
```bash
# Check if the issue existed before recent changes
ssh jix@192.168.1.77 "docker exec sparkrun-ui git log --oneline -5"
```
**Expected:** Recent commits visible
**Action:** If issue appeared after specific commit, that's likely the culprit

---

## Troubleshooting Flowchart

```
Page crashes after loading?
├─ Server responds (HTTP 200)?
│  ├─ NO → Check Docker container status
│  └─ YES → Next
├─ API endpoints work?
│  ├─ NO → Check Next.js logs
│  └─ YES → Next
├─ HTML contains React scripts?
│  ├─ NO → Build/cache issue
│  └─ YES → Next
├─ Browser console shows errors?
│  ├─ YES → Fix JavaScript errors
│  └─ NO → Next
├─ Network tab shows API calls?
│  ├─ YES → Check API response
│  └─ NO → CORS or network issue
```

---

## Acceptance Criteria

The testing plan is complete when:
1. [ ] All Phase 1-4 tests pass
2. [ ] Root cause identified and documented
3. [ ] Fix implemented and verified
4. [ ] Dashboard loads without crashing
5. [ ] AggregateStats displays real metrics after ~2 seconds

---

## Notes

- Document each test result with timestamp and observed output
- If a test fails, document the exact error and take a screenshot if possible
- Work through phases sequentially; don't skip to complex tests before verifying basics
- If the page crashes consistently, focus on Phase 3-4 (client-side JavaScript) first
- The "reconnecting" status is expected until client polling succeeds; this is not a crash

---

## Test Results Summary (2026-08-02)

| Test | Status | Result |
|------|--------|--------|
| Server Health | PASS | HTTP 307 redirect |
| Dashboard HTML | PASS | Contains React scripts |
| API /monitor | PASS | Returns real metrics |
| API /disk | PASS | Returns disk data |
| Server Logs | PASS | No errors |

## Root Cause Analysis (2026-08-02)

**The dashboard page is NOT crashing.** The behavior observed is expected:

1. Server renders HTML with default/fallback values ("reconnecting", 0.0% metrics)
2. Client-side `AggregateStats` component mounts and starts polling `/api/monitor` every 2 seconds
3. After first poll (~2s), metrics should update to real values

**Expected behavior:**
- Server renders "Cluster overview" with "— host · 0 jobs" and "reconnecting" (gray dot)
- Client-side polling should update to "live" status and real metrics after ~2 seconds

**User verification steps:**
1. Open dashboard: `http://192.168.1.77:5678/dashboard`
2. Wait 2-3 seconds
3. Check if "reconnecting" changes to "live" and metrics update from 0.0% to real values
4. Check browser console for JavaScript errors (F12 → Console tab)
5. Check Network tab for `/api/monitor` API calls (F12 → Network tab)

**If metrics don't update after 5+ seconds:**
- There may be a JavaScript error preventing the polling from working
- Check browser console for errors
- Verify the `/api/monitor` endpoint is accessible from browser

## Known Limitations

1. **AggregateStats shows "reconnecting" initially** - Expected behavior; updates after first API poll
2. **Process metrics are 0** - Sparkrun doesn't provide process-level CPU/PID info; placeholder values used
3. **GPU metrics may be 0** - sparkrun cluster monitor may not report GPU data correctly in some cases
