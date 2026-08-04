# sparkrun-ui — Claude Code

**CUSTOM/PRIVATE REPO** — Local version with ARM64 fixes, process data display, and Docker network_mode: host fixes.

Read CONVENTIONS.md before any GitHub or git operation.

CRITICAL: This is a CUSTOM/PRIVATE version. DO NOT CONFUSE WITH UPSTREAM sparkrun-ui repository.

All scripts and documentation must use: `/home/shade/Pidev_proj/sparkrun-ui`

<!-- BEGIN bigpowers:project -->
## Project

Web UI for sparkrun — launch and monitor inference workloads on NVIDIA DGX Spark clusters from a browser.

Stack: TypeScript, Next.js 16 App Router, React 19, Node.js 22+, pnpm 10+

<!-- END bigpowers:project -->

<!-- BEGIN bigpowers:commands -->
## Commands

| Action | Command |
|--------|---------|
| Run | `pnpm dev` |
| Test | `pnpm test` |
| Build | `pnpm build` |
| Lint | `pnpm lint` |
| Typecheck | `pnpm typecheck` |
| Preflight | `pnpm typecheck && pnpm lint && pnpm test && pnpm build` |
| CI | `gh pr checks` (when a PR is open) |

<!-- END bigpowers:commands -->

<!-- BEGIN bigpowers:architecture -->
## Architecture

Next.js 16 App Router with React 19 Server/Client Components. oRPC for end-to-end type-safe RPC. Base UI for unstyled primitives, Tailwind CSS 4 for styling, CodeMirror 6 for YAML editor, zod for validation. Backend is sparkrun CLI via child_process.spawn. Reads sparkrun cache (~/.cache/sparkrun/*) for richer state.

<!-- END bigpowers:architecture -->

<!-- BEGIN bigpowers:conventions -->
## Conventions

- **Workflow Mandate:** You MUST use the bigpowers skills (e.g. `plan-work`, `develop-tdd`, `orchestrate-project`) to perform tasks. DO NOT write code directly in response to a user prompt like "build this feature".
- **Always Green:** Preflight and CI must be green before forward work. Reproducible gate failures require **fix-or-log** (quick-fix → fix-bug) per CONVENTIONS § Discovered Defects.
- Read specs/ before writing code.
- All planning and specifications MUST be written to `specs/` before any code is generated.
- Write the minimum code that solves the stated problem. Nothing extra.
- Run tests after every change. Show evidence before declaring done.
- One clarifying question beats a wrong assumption baked into 200 lines.
- **TDD Process:** One commit for tests (RED), one commit for implementation (GREEN). Never combine them.
- **SSH User:** Use `jix` as the SSH user for remote host `192.168.1.77`.
- **Docker Build:** Use `docker build -t sparkrun-ui:custom .` instead of `docker compose build` to bypass `pull_policy: never`.

<!-- END bigpowers:conventions -->

<!-- BEGIN bigpowers:never -->
## Never

- Never dismiss reproducible gate failures as pre-existing or out of scope
- Never proceed on red Preflight or red CI — invoke quick-fix or fix-bug first
- Never work directly on `main` branch — always create a feature branch first
- Never skip planning — always write specs/ before code
- Never use `any` type without justification
- Never commit `console.log` statements to production code
- Never merge code with failing tests

<!-- END bigpowers:never -->

<!-- BEGIN bigpowers:agent-rules -->
## Agent Rules

- **Workflow Mandate:** You MUST use the bigpowers skills (e.g. `plan-work`, `develop-tdd`, `orchestrate-project`) to perform tasks. DO NOT write code directly in response to a user prompt like "build this feature".
- **Always Green:** Preflight and CI must be green before forward work. Reproducible gate failures require **fix-or-log** (quick-fix → fix-bug) per CONVENTIONS § Discovered Defects.
- Read specs/ before writing code.
- All planning and specifications MUST be written to `specs/` before any code is generated.
- Write the minimum code that solves the stated problem. Nothing extra.
- Run tests after every change. Show evidence before declaring done.
- One clarifying question beats a wrong assumption baked into 200 lines.
- **TDD Process:** One commit for tests (RED), one commit for implementation (GREEN). Never combine them.
- **Branch Policy:** Never commit directly to `main`. Always use feature branches.

<!-- END bigpowers:agent-rules -->

<!-- BEGIN bigpowers:context-routing -->
## Context Routing

| Glob | Instructions |
|------|--------------|
| `*.md` | General project context (read first) |
| `specs/**/*.yaml` | Planning documents (read before coding) |
| `lib/**/*.ts` | Backend logic and RPC procedures |
| `app/**/*.tsx` | React components and pages |
| `scripts/*.mjs` | Build and utility scripts |

<!-- END bigpowers:context-routing -->
