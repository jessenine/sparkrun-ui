# IMPACT_LATEST.md

## Impact Analysis Log

### 2026-08-01 - Initial Project Setup

**Status:** N/A (new project)

**Details:** Project just initialized. No impact analysis needed yet.

---

## Impact Assessment Process

### When to Assess Impact

1. **Before adding features** — Use `assess-impact` skill
2. **Before major refactors** — Check dependency blast radius
3. **When debugging** — Map affected stories and tests
4. **Before releases** — Review test coverage gaps

### Impact Categories

| Category | Scope | Assessment Tool |
|----------|-------|-----------------|
| New feature | Whole project | `assess-impact` |
| Bug fix | Single module | `trace-requirement` |
| Refactor | Single module | Code search |
| Dependency upgrade | All modules | CI test matrix |

### Impact Matrix

| Change Type | Affected Modules | Affected Tests | Risk Level |
|-------------|------------------|----------------|------------|
| New feature | lib/, app/ | lib/**/*.test.ts | Medium |
| Bug fix | Single file | Single test file | Low |
| Refactor | Single file | All tests in file | Medium |
| Dependency upgrade | All files | All tests | High |
| API change | lib/rpc/, app/ | All RPC tests | High |

### Risk Mitigation

- **High risk:** Write tests first (TDD), review with `request-review`
- **Medium risk:** Run full test suite, check CI
- **Low risk:** Quick test run, manual verification

## Recent Impact Assessments

None yet.
