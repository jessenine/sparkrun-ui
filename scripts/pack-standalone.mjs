#!/usr/bin/env node
// Arranges the Next.js standalone build into ./dist for npm publish.
// Run automatically by the `prepack` script after `next build`.

import { cp, mkdir, rm, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const STANDALONE = resolve(ROOT, ".next/standalone");
const STATIC = resolve(ROOT, ".next/static");
const PUBLIC = resolve(ROOT, "public");
const DIST = resolve(ROOT, "dist");

const STANDALONE_APP_DIR = "Pidev_proj/sparkrun-ui";

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

const execPromise = promisify(exec);

if (!(await exists(STANDALONE))) {
  console.error(`pack-standalone: ${STANDALONE} not found — run \`pnpm build\` first.`);
  process.exit(1);
}

await rm(DIST, { recursive: true, force: true });

const nestedApp = resolve(STANDALONE, STANDALONE_APP_DIR);

// Copy server.js
const serverJs = resolve(nestedApp, "server.js");
if (await exists(serverJs)) {
  await cp(serverJs, resolve(DIST, "server.js"), { recursive: true });
  console.log("pack-standalone: copied server.js");
}

// Copy node_modules (app's dependencies)
const nestedNodeModules = resolve(nestedApp, "node_modules");
if (await exists(nestedNodeModules)) {
  await cp(nestedNodeModules, resolve(DIST, "node_modules"), { recursive: true });
  console.log("pack-standalone: copied node_modules");
}

// Copy .next (app's Next.js output)
const nestedNext = resolve(nestedApp, ".next");
if (await exists(nestedNext)) {
  await cp(nestedNext, resolve(DIST, ".next"), { recursive: true });
  console.log("pack-standalone: copied .next");
}

await cp(STATIC, resolve(DIST, ".next/static"), { recursive: true });
if (await exists(PUBLIC)) {
  await cp(PUBLIC, resolve(DIST, "public"), { recursive: true });
}

// ORPC uses dynamic imports that Next.js's file tracer can't detect.
const srcNodeModules = resolve(ROOT, "node_modules");
const distNodeModules = resolve(DIST, "node_modules");
const standaloneNodeModules = resolve(STANDALONE, "node_modules");

const orpcPackages = ["@orpc/client", "@orpc/server", "@orpc/rpc", "@orpc/protocol"];
for (const pkg of orpcPackages) {
  const srcPkg = resolve(srcNodeModules, pkg);
  const distPkg = resolve(distNodeModules, pkg);
  const standalonePkg = resolve(standaloneNodeModules, pkg);
  if (await exists(srcPkg)) {
    await mkdir(resolve(distNodeModules, "@orpc"), { recursive: true });
    await mkdir(resolve(standaloneNodeModules, "@orpc"), { recursive: true });
    await cp(srcPkg, distPkg, { recursive: true, dereference: true });
    await cp(srcPkg, standalonePkg, { recursive: true, dereference: true });
    console.log(`pack-standalone: copied ${pkg} to dist and .next/standalone`);
  }
}

// Also copy lib/rpc procedures to both locations
const srcRpc = resolve(ROOT, "lib/rpc");
const distRpc = resolve(DIST, "lib/rpc");
const standaloneRpc = resolve(STANDALONE, "lib/rpc");
if (await exists(srcRpc)) {
  await cp(srcRpc, distRpc, { recursive: true });
  await cp(srcRpc, standaloneRpc, { recursive: true });
  console.log("pack-standalone: copied lib/rpc to dist and .next/standalone");
}

// Copy Dockerfile to dist for remote build
const dockerfile = resolve(ROOT, "Dockerfile");
if (await exists(dockerfile)) {
  await cp(dockerfile, resolve(DIST, "Dockerfile"), { recursive: true });
  console.log("pack-standalone: copied Dockerfile");
}

console.log("pack-standalone: dist/ ready (server.js, .next, node_modules, public, Dockerfile)");

// Create dist.tar.gz for deployment
console.log("pack-standalone: creating dist.tar.gz");
try {
  await execPromise("tar czf dist.tar.gz -C dist .");
  console.log("pack-standalone: created dist.tar.gz");
} catch (err) {
  console.error("pack-standalone: failed to create dist.tar.gz", err.message);
  process.exit(1);
}
