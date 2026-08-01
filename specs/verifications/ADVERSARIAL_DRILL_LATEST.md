# ADVERSARIAL_DRILL_LATEST.md

## Adversarial Drill Log

### 2026-08-01 - Initial Project Setup

**Status:** N/A (new project)

**Details:** Project just initialized. No adversarial drills needed yet.

---

## Adversarial Drill Process

### When to Run Drills

1. **Before release** — Stress test critical paths
2. **After major changes** — Verify no new failure modes
3. **Post-incident** — Test improvements to prevent recurrence

### Drill Categories

| Category | Focus | Failure Mode |
|----------|-------|--------------|
| **Connectivity** | Cluster SSH connections | Timeout, auth failure |
| **Data** | Cache reading | Corrupt JSON, missing fields |
| **Concurrency** | Multiple workloads | Race conditions, deadlock |
| **Resource** | Memory/CPU limits | OOM, slow response |
| **Edge** | Boundary conditions | Empty lists, max values |

### Drill Template

```
## Drill: [Name]

**Objective:** [What we're testing]

**Setup:**
- [Preconditions]

**Steps:**
1. [Action 1]
2. [Action 2]

**Expected Failure Modes:**
- [Failure 1]
- [Failure 2]

**Observed Behavior:**
- [What actually happened]

**Lessons Learned:**
- [Improvement 1]
- [Improvement 2]
```

### Recent Drills

None yet.
