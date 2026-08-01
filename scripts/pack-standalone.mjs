#!/usr/bin/env node
// Arranges the Next.js build into ./dist for npm publish.
// Run automatically by the `prepack` script after `pnpm build`.

import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const NEXT = resolve(ROOT, ".next");
const STATIC = resolve(ROOT, ".next/static");
const PUBLIC = resolve(ROOT, "public");
const NODE_MODULES = resolve(ROOT, "node_modules");
const DIST = resolve(ROOT, "dist");

// Entries inside .next that we actually need at runtime.
const NEXT_KEEP = new Set(["server.js", "static"]);

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

await rm(DIST, { recursive: true, force: true });

// Copy .next directory
await cp(NEXT, resolve(DIST, ".next"), { recursive: true });
console.log(`pack-build: copied .next to dist`);

// Copy public directory if it exists
if (await exists(PUBLIC)) {
  await cp(PUBLIC, resolve(DIST, "public"), { recursive: true });
  console.log(`pack-build: copied public to dist`);
}

// ORPC uses dynamic imports that Next.js's file tracer can't detect.
// We must manually include @orpc packages and lib/rpc procedures.
const srcNodeModules = resolve(ROOT, "node_modules");
const distNodeModules = resolve(DIST, "node_modules");

const orpcPackages = ["@orpc/client", "@orpc/server", "@orpc/rpc", "@orpc/protocol"];
for (const pkg of orpcPackages) {
  const srcPkg = resolve(srcNodeModules, pkg);
  const distPkg = resolve(distNodeModules, pkg);
  if (await exists(srcPkg)) {
    await mkdir(resolve(distNodeModules, "@orpc"), { recursive: true });
    // Use copy instead of symlink to avoid broken links in container
    await cp(srcPkg, distPkg, { recursive: true, dereference: true });
    console.log(`pack-build: copied ${pkg} to dist/node_modules`);
  }
}

// Also copy lib/rpc procedures
const srcRpc = resolve(ROOT, "lib/rpc");
const distRpc = resolve(DIST, "lib/rpc");
if (await exists(srcRpc)) {
  await cp(srcRpc, distRpc, { recursive: true });
  console.log("pack-build: copied lib/rpc to dist");
}

console.log("pack-build: dist/ ready (.next, node_modules, public)");
