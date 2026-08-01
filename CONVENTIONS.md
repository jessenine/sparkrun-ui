# sparkrun-ui — CONVENTIONS.md

## Always Green / Shift Left

**1-10-100 Rationale:**
- **1:** Fix a bug during development costs ~1 unit of effort
- **10:** Fix the same bug after release costs ~10 units
- **100:** Fix the same bug in production costs ~100 units

**Preflight Definition:**
- `pnpm typecheck` — No TypeScript errors
- `pnpm lint` — No ESLint errors
- `pnpm test` — All tests pass
- `pnpm build` — Build completes without errors

**CI Definition:**
- GitHub Actions workflow must pass
- `gh pr checks` must show green

**Policy:** If Preflight or CI is red, **STOP**. Run `quick-fix` or `fix-bug` first.

## Discovered Defects

When you find a bug (in your changes or pre-existing):

### Fix-or-Log Ladder

1. **Quick-fix:** If the bug is trivial (data-only change, no logic risk)
   - `quick-fix` skill
   - Single commit, no test needed

2. **Fix-bug:** If the bug needs investigation or logic changes
   - `investigate-bug` → `diagnose-root` → `develop-tdd` → `validate-fix`
   - Separate commits: test-only (RED), then fix (GREEN)

### Never Say These Phrases

| Banned Phrase | Why |
|---------------|-----|
| "pre-existing" | Ignoring a red gate is prohibited |
| "unrelated to my changes" | Gate failures must be fixed |
| "out of scope" | Defects block forward progress |
| "will fix later" | Log the defect, don't defer |

## Git Policy

- **Main branch protection:** Direct commits to `main` are prohibited
- **Feature branches:** Always create a branch (`git checkout -b feat/<name>`)
- **Worktree option:** Use `git worktree add` for parallel development
- **Kickoff first:** Run `kickoff-branch` before any code changes
- **Clean tree:** Working tree must be clean before kickoff (except spec artifacts)

## Testing Policy

- **F.I.R.S.T principles:** Fast, Independent, Repeatable, Self-Validating, Timely
- **TDD process:** RED (test fails) → GREEN (test passes) → REFACTOR
- **Two-commit rule:** Test-only commit (RED), then fix commit (GREEN)
- **Coverage target:** 80%+ for new code, 100% for critical paths
- **Tests before code:** Never write implementation before tests (except quick-fix)

## Code Review Policy

- **Review before merge:** All changes must be reviewed (peer or agent)
- **Audit-code first:** Run `audit-code` before `request-review`
- **Respond to feedback:** Address all review comments before merging
- **One reviewer minimum:** At least one approval required

## Release Policy

- **Versioning:** Semantic versioning (MAJOR.MINOR.PATCH)
- **Branch protection:** `main` branch is protected
- **Release notes:** Update CHANGELOG.md before tagging
- **Docker:** Build and test Docker image before release

## Security Policy

- **No auth:** Assumes trusted network only (no authentication layer)
- **SSH keys:** Read-only bind mount, never exposed in container
- **sparkrun CLI:** Read-only bind mount, PATH restricted
- **Network:** Bind to trusted network, no public exposure

## Performance Policy

- **Metrics refresh:** 2-3 seconds for dashboard
- **API latency:** <100ms for one-shot RPC calls
- **Page load:** <1s for initial page render
- **Log tail:** <1s latency for live streaming

## Accessibility Policy

- **Semantic HTML:** Use proper HTML elements (not div soup)
- **ARIA labels:** Add labels for interactive elements
- **Keyboard nav:** All interactive elements keyboard-accessible
- **Contrast:** Minimum 4.5:1 text-to-background ratio

## Dependency Policy

- **Update strategy:** Major versions only via `update-major` skill
- **Security:** Run `pnpm audit` before merging dependency updates
- **Lockfile:** Commit pnpm-lock.yaml with every dependency change
- **Version pinning:** Use exact versions (no caret or tilde)

## Documentation Policy

- **API docs:** Document all RPC procedures
- **Component docs:** Document component props and usage
- **Architecture docs:** Update tech-stack.md for major changes
- **Decision records:** Log architecture decisions in `specs/adr/`

## Configuration Policy

- **Environment variables:** Document all required env vars
- **Secrets:** Never commit secrets (use .env.example)
- **Default values:** Provide sensible defaults for optional config
- **Validation:** Validate all configuration at startup
