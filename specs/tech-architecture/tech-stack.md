# tech-stack.md

## Stack

- **Framework:** Next.js 16 App Router (Turbopack)
- **Language:** TypeScript 5+
- **Runtime:** Node.js 22+ (minimum: Node 20)
- **Package Manager:** pnpm 10+
- **UI Library:** Base UI (@base-ui/react)
- **Styling:** Tailwind CSS 4
- **Form Validation:** zod
- **RPC:** oRPC (@orpc/client, @orpc/server)
- **Code Editor:** CodeMirror 6 (@codemirror/*)
- **YAML Processing:** yaml
- **Charts:** recharts
- **Icons:** lucide-react
- **Testing:** vitest with @vitest/coverage-v8

## Backend Integration

- **Backend:** sparkrun CLI (shelled out via child_process.spawn)
- **Cache:** ~/.cache/sparkrun/* (read directly for richer state)

## Architecture

**Data Flow:**

```
User → Next.js App Router (Server Components) → oRPC → Client Components
                                            ↓
                                    sparkrun CLI (spawn)
                                            ↓
                                    ~/.cache/sparkrun/*
```

**Key Modules:**

| Module | Purpose |
|--------|---------|
| `app/` | Next.js App Router pages and components |
| `lib/rpc/` | oRPC procedures and router |
| `lib/sparkrun.ts` | CLI spawning helpers (one-shot + streaming) |
| `lib/schemas.ts` | zod schemas for CLI JSON shapes |
| `lib/state.ts` | Disk readers for ~/.cache/sparkrun/* |
| `lib/draft.ts` | Per-draft tempfile lifecycle for wizard |
| `lib/workloadStatus.ts` | Workload health aggregation |

**Component Pattern:**

- **Server Components** for initial page render and data fetching
- **Client Components** for interactive elements (dashboard metrics, launch wizard, chat)
- **Hybrid approach** where Server Components load initial state, Client Components enhance with reactivity

## Conventions (Observed)

- **Error Handling:** CLI errors bubble up as exceptions; graceful degradation via empty states
- **API Shapes:** oRPC procedures return typed JSON; CLI output parsed via zod
- **Type Safety:** Strict TypeScript; avoid `any` where possible
- **Testing Strategy:** vitest for unit tests; snapshot tests for components
- **Code Style:** Prettier + ESLint; one commit for tests (RED), one for implementation (GREEN)

## Signals / Active Considerations

- **No auth layer** — the UI assumes trusted network access
- **No persistence layer** — reads sparkrun cache directly, no separate database
- **Long-running mutations** — benchmarks fire-and-forget; source of truth is sparkrun
- **SSH user configuration** — HOST_USER environment variable determines SSH user for cluster monitoring
- **ORPC streaming** — eventIterator used for live views (Server-Sent Events under the hood)
