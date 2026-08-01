# Specs

All planning documents for this project.

## Directory Structure

```
specs/
├── product/              # Product requirements
│   ├── SCOPE_LATEST.yaml
│   ├── VISION_LATEST.yaml
│   └── GLOSSARY_LATEST.yaml
├── tech-architecture/    # Architecture documentation
│   ├── tech-stack.md
│   ├── SECURITY_PLAN_LATEST.md
│   ├── TEST_PLAN_LATEST.md
│   └── DESIGN_PLAN_LATEST.md
├── verifications/        # Verification and testing specs
├── epics/                # Active epic work (created dynamically)
│   └── archive/          # Completed epic work
├── bugs/                 # Bug tracking
│   └── registry.yaml
├── adr/                  # Architecture Decision Records
├── release-plan.yaml     # Versioned release index
├── execution-status.yaml # Flat story/epic status
├── planning-status.yaml  # Discover-phase checklist (optional)
└── state.yaml            # Session state and handoff
```

## Guidelines

- All planning documents use YAML or Markdown format
- `LATEST` suffix indicates the current version of a document
- `adr/` stores permanent architecture decisions
- `epics/` contains active work; `epics/archive/` stores completed work
- `state.yaml` tracks session progress and handoffs
