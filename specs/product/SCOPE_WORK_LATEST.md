# scope-work

## Project Name and Description

**Project:** sparkrun-ui  
**One Sentence:** Web UI for sparkrun — launch and monitor inference workloads on NVIDIA DGX Spark clusters from a browser.

## In Scope

1. Dashboard — Live-updating view of running workloads with one-click stop
2. Recipes — Browse and filter recipes from multiple registries
3. Launch Wizard — Pick recipe, edit YAML, preview, launch, tail logs
4. Chat — Talk to running models from browser
5. Benchmarks — History, charts, new runs
6. Logs — Terminal-style live tail with ANSI color
7. Monitor — Per-host CPU/GPU/memory/power/temperature bars and sparklines

## Out of Scope

- Direct sparkrun cluster management (uses sparkrun CLI as backend)
- User authentication or authorization
- Persistent data storage (reads sparkrun cache directly)
- Model hosting or inference execution
- Multi-cluster orchestration (single cluster per UI instance)
- User accounts and permissions
- Persistent job history beyond sparkrun cache
- Automated model selection or tuning

## Constraints

- Must use sparkrun CLI as backend (no direct cluster management)
- Must be browser-based, no native apps
- Must be network-accessible (Docker or npx deployment)
- Must work with existing sparkrun cluster configurations

## Success Criteria

- Launch workload in under 30 seconds from recipe selection
- Dashboard refresh rate of 2-3 seconds for live metrics
- 95% of recipes launch on first attempt without YAML editing
- Support for 5+ active workloads per DGX node without performance degradation

## Next Steps

- **Scope:** ✅ Defined
- **Next:** `research-first` (optional — skip for this project, no external dependencies)
- **Next:** `elaborate-spec` (optional — can be skipped)
- **Next:** `plan-release` (sequence epics)
- **Next:** `slice-tasks` (cut vertical slices)

## Acceptance

- [x] Project name and description captured
- [x] In-scope features identified
- [x] Out-of-scope items documented
- [x] Constraints and success criteria defined
- [x] Scope saved to `specs/product/SCOPE_LATEST.yaml`
