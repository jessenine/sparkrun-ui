# SECURITY_PLAN_LATEST.md

## Threat Model

### Asset Classification

| Asset | Sensitivity | Storage |
|-------|-------------|---------|
| sparkrun CLI execution | HIGH | Host shell |
| Cluster SSH keys | CRITICAL | ~/.ssh (bind-mounted) |
| Config (clusters, registries) | MEDIUM | ~/.config/sparkrun |
| Job cache | LOW | ~/.cache/sparkrun |

### Attack Vectors

| Vector | Mitigation |
|--------|------------|
| Remote code execution via sparkrun CLI | Bind-mount read-only; PATH restricted |
| SSH key exposure | Read-only bind-mount; container user isolation |
| Cross-user cluster access | HOST_USER enforces SSH user |
| Network eavesdropping | Bind to trusted network only (no auth) |
| Local privilege escalation | Non-root container user (app:1000) |

### Trust Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Trusted Network Only                     │
│              (No authentication implemented)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      sparkrun-ui Container                  │
│  - Non-root user (app:1000)                                 │
│  - Read-only bind mounts: sparkrun, .ssh, .cache            │
│  - Write access: only /home/app/.cache (sparkrun cache)     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      sparkrun CLI (Host)                    │
│  - Runs as HOST_USER (not root)                             │
│  - SSH keys mounted read-only                               │
│  - Cluster hosts reached as HOST_USER                       │
└─────────────────────────────────────────────────────────────┘
```

### Known Vulnerabilities

- **None identified** - No auth layer is intentional design (assumes trusted network)

### Security Checklist

- [x] Read-only bind mounts for sensitive files
- [x] Non-root container user
- [x] PATH restriction to sparkrun binary
- [x] SSH keys mounted read-only
- [ ] Network isolation (assumes trusted LAN)
- [ ] Audit logging (future enhancement)

### Security Contact

Report security issues via GitHub Issues.
