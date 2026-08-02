# ORPC Framework Issues with Next.js Standalone Builds

## Problem

The ORPC framework (`@orpc/server`) is ESM-only and uses lazy procedures that rely on dynamic `import()` calls. Next.js standalone builds bundle all modules but can't properly transform these runtime dynamic imports, causing:

1. `METHOD_NOT_SUPPORTED` errors when accessing ORPC endpoints
2. Event iterator validation failures for streaming endpoints

## Root Cause

ORPC's `os()` function creates procedures with lazy loading:
```typescript
export const procedure = os.input(...).output(...).handler(...)
```

This creates a "lazy" procedure that uses `import()` at runtime to load the handler. Next.js standalone builds bundle these modules but the `import()` calls remain as runtime dynamic imports, which fail because:
- The modules are already bundled (no separate file to import)
- ORPC's router expects to dynamically import procedures at runtime

## Solution

### Option 1: Use Regular Build (Current)
Instead of `output: "standalone"` in Next.js config, use regular build output and copy `node_modules` with the application. This preserves ORPC's lazy loading mechanism.

**Tradeoff**: Larger Docker image (includes `node_modules`), but ORPC works correctly.

### Option 2: Use Next.js API Routes
Replace ORPC streaming endpoints with regular Next.js API routes:
```typescript
// app/api/monitor/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Direct function call, no ORPC involved
  const data = await fetchMonitorData();
  return NextResponse.json(data);
}
```

**Tradeoff**: More code to maintain, but full control over API behavior.

### Option 3: Fork ORPC
Modify ORPC to support ESM-only builds or Ahead-of-Time (AOT) compilation that transforms lazy procedures into eager ones.

**Tradeoff**: Significant development effort, maintenance burden.

## Current Status

The fix using regular build (Option 1) is deployed. The dashboard loads but streaming endpoints fail with `EVENT_ITERATOR_VALIDATION_FAILED`.

This indicates the ORPC framework's `eventIterator()` type validation has additional requirements beyond just the schema. The fetch adapter may be expecting a specific event format that doesn't match what we're producing.

## Next Steps

1. Investigate ORPC's eventIterator implementation to understand the expected event format
2. Consider migrating streaming endpoints to Next.js API routes
3. If ORPC is essential, file an issue with the ORPC maintainers
