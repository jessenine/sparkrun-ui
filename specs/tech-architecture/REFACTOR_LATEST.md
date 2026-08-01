# REFACTOR_LATEST.md

## Recent Refactor Log

### 2026-08-01 - Initial Project Setup

**Status:** N/A (new project)

**Details:** Project just initialized. No refactors needed yet.

---

## Refactor Criteria

### When to Refactor

1. **Duplication** — Same logic in multiple places
2. **Long functions** — Functions >50 lines or deep nesting
3. **Shallow modules** — Modules that just pass through
4. **Feature envy** — Code that uses another module's data more than its own
5. **Primitive obsession** — Passing primitive values that should be objects

### What Not to Refactor

1. **Working production code** — Only refactor when adding features
2. **Test-only code** — Tests can have duplication for clarity
3. **Generated code** — Let tooling manage its own output
4. **Deprecated code paths** — Remove, don't refactor

## Refactor Process

1. **Create branch** — `git checkout -b refactor/<feature>`
2. **Add tests** — Ensure existing tests pass before changes
3. **Make changes** — Refactor with tests still passing
4. **Update docs** — Update this file and tech-stack.md if needed
5. **Merge** — PR with refactoring only (no feature changes)

## Historical Refactors

None yet.
