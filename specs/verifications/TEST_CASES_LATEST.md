# TEST_CASES_LATEST.md

## Test Cases Registry

### 2026-08-01 - Initial Project Setup

**Status:** N/A (new project)

**Details:** Project just initialized. No test cases defined yet.

---

## Test Case Template

```
## Test: [Name]

**Purpose:** [What this test verifies]

**Input:**
- [Input 1]
- [Input 2]

**Expected Output:**
- [Output 1]
- [Output 2]

**Edge Cases:**
- [Edge case 1]
- [Edge case 2]

**Test File:** `path/to/test.ts`

**Status:** draft | ready | passing | failing
```

## Test Case Categories

| Category | Files | Status |
|----------|-------|--------|
| Schema Validation | `lib/schemas.test.ts` | Draft |
| Helper Functions | `lib/**/*.test.ts` | Draft |
| RPC Endpoints | `lib/rpc/**/*.test.ts` | Draft |
| Components | `app/**/*.test.tsx` | Draft |

## Known Test Gaps

- No E2E tests for full user flows
- No component snapshot tests for visual regression
