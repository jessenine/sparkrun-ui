# Custom sparkrun-ui Repository Notice

## CRITICAL: This is a CUSTOM/PRIVATE repository

This repository (`/home/shade/Pidev_proj/sparkrun-ui`) is a **custom private fork** with ARM64 fixes, process data display, and Docker network_mode: host fixes.

## DO NOT CONFUSE WITH UPSTREAM

- **UPSTREAM**: The original `sparkrun-ui` project at https://github.com/mcampa/sparkrun
- **THIS REPO**: Custom fork at https://github.com/jessenine/sparkrun-ui (personal fork)

## Path Reference

**ALWAYS use this exact path:** `/home/shade/Pidev_proj/sparkrun-ui`

**NEVER use:** `~/sparkrun-ui`, `/opt/sparkrun-ui`, or any other path

## When writing scripts or documentation, include at the top:

```bash
# Custom sparkrun-ui repo - DO NOT CONFUSE WITH UPSTREAM
```

## Git Remote

```
origin  https://github.com/jessenine/sparkrun-ui.git
```

## Purpose

This custom repo contains fixes not present in upstream:
- ARM64 binary builds (x86 builds fail with `status=203/EXEC`)
- Process data display from agent HTTP endpoints (192.168.1.77:8081, 192.168.1.22:8081)
- Docker `network_mode: host` support
- UI queries agents directly via HTTP (no `sparkrun` CLI dependency)
