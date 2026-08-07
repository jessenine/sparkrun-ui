# BUG-20260807T184042: Recipe validation fails with EACCES on draft directory

## Metadata

| Field | Value |
|-------|-------|
| **Bug ID** | `BUG-20260807T184042` |
| **Date** | 2026-08-07 |
| **Severity** | high |
| **Priority** | 1 |
| **Scope** | api |
| **Status** | open |
| **Assigned to** | agent |
| **Created by** | agent |

## Symptom

Launching any recipe from the Recipes catalog shows a toast: **"Validation failed, Internal server error"**. This happens on every recipe, not just specific ones. The error occurs during the "Edit & validate" step when the frontend calls `rpc.recipes.validate`.

User reports the error when accessing:
```
http://192.168.1.77:5678/launch?recipe=%40official%2Fdeepseek-v4-flash-0731-b12x-dspark-vllm
```

## Root Cause

The `validate` RPC handler calls `writeDraft(input.draftId, input.yaml)` to persist the recipe YAML as a temp file before running `sparkrun recipe validate <path> --json`. The `writeDraft` function creates the draft directory and writes a file to:

```
/tmp/sparkrun-ui-drafts/<draftId>.yaml
```

Inside the Docker container, the Next.js server runs as user **`app`** (via `gosu app` in the entrypoint). The `/tmp/sparkrun-ui-drafts/` directory was initially created by user **`root`** (e.g. during initial setup or by earlier diagnostic commands run as root). The directory has permissions `drwxr-xr-x` (755) owned by `root:root`.

When `writeDraft` calls `mkdir(DRAFT_DIR, { recursive: true })`, this succeeds silently because the directory already exists. But when it then calls `writeFile(path, yaml)` to create the draft file, the OS throws:

```
EACCES: permission denied, open '/tmp/sparkrun-ui-drafts/d_m9p8gy1xmsj8wo4o.yaml'
```

This uncaught error propagates to the ORPC handler interceptor, which logs it and returns a 500 response with `"Internal server error"`.

## Impact

- **All recipe launch attempts fail** — users cannot launch any recipe from the UI
- No manual workaround available for end users
- Blocking any recipe-based workflow from the UI

## Evidence

Docker logs show the exact error for every validation attempt:

```
[rpc] ORPC error: Error: EACCES: permission denied, open '/tmp/sparkrun-ui-drafts/d_<draftId>.yaml'
```

Directory inspection confirms root ownership:

```
$ ls -la /tmp/ | grep sparkrun
drwxr-xr-x 2 root root 4096 Aug  7 18:31 sparkrun-ui-drafts
```

Test validation as root succeeds (creating `debug_validate.yaml`), but any attempt from the Next.js process (running as `app`) fails.

## Fix Strategy

**File**: `lib/draft.ts`

The `ensureDir` function creates the directory with `mkdir({ recursive: true })` but does not guarantee it is writable by the application user. Add an explicit `chmod` to 0o777 (world-writable) after creating the directory:

```typescript
import { chmod } from "node:fs/promises";

async function ensureDir() {
  await mkdir(DRAFT_DIR, { recursive: true });
  await chmod(DRAFT_DIR, 0o777);
}
```

This ensures that even if a previous container run (as root) created the directory, the `app` user can always write draft files into it.

### Alternative considered

Use `access(DRAFT_DIR, W_OK)` and fall back to a user-writable temp location. The chmod approach is simpler and avoids changing the storage location for transient draft files.

## Verification

After applying the fix:

1. Restart the container: `docker restart sparkrun-ui`
2. Navigate to any recipe's launch page
3. Verify no "Validation failed" toast appears
4. Verify `rpc.recipes.validate` returns HTTP 200 with valid=true
5. Verify `ls -la /tmp/sparkrun-ui-drafts/` shows `drwxrwxrwx` permissions

## Related Issues

- Host key verification failures also observed in `sparkrun cluster status --json` (both hosts show "Host key verification failed") — separate issue from the EACCES bug
- The `debug_validate.yaml` file owned by root will need cleaning after the fix

## References

- Reproduction URL: `http://192.168.1.77:5678/launch?recipe=%40official%2Fdeepseek-v4-flash-0731-b12x-dspark-vllm`
- Error pattern in docker logs: `[rpc] ORPC error: Error: EACCES: permission denied, open '/tmp/sparkrun-ui-drafts/...'`
