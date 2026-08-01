# CHECKLIST_LATEST.md

## Verification Checklist

### Preflight (Before Commit)

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] No `console.log` statements in production code
- [ ] No `any` types without justification
- [ ] New/changed code has tests
- [ ] Error cases handled (not just success path)

### Code Review (Before Merge)

- [ ] Changes match PR description
- [ ] Tests cover all new behavior
- [ ] No breaking changes (unless documented)
- [ ] Documentation updated (if needed)
- [ ] No security issues introduced
- [ ] Performance not regressed

### Release (Before Tag)

- [ ] All tests pass
- [ ] CI pipeline green
- [ ] Changelog updated
- [ ] Version bumped (semver)
- [ ] Docker build verified
- [ ] Production deployment tested

### Post-Release

- [ ] Monitoring dashboard shows healthy metrics
- [ ] No new error logs in past 24h
- [ ] Users can perform critical workflows
- [ ] Performance metrics within bounds
