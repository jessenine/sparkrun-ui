import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use regular output instead of standalone to avoid ORPC framework's
  // dynamic import issues in standalone builds. The ORPC framework is
  // ESM-only and uses lazy procedures with dynamic import() which don't
  // work properly in Next.js standalone builds.
  // output: "standalone",
  // Accept HMR / origin requests from any host (dev only).
  // Next uses micromatch where `*` doesn't cross dots, so an IPv4
  // address needs `*.*.*.*`. `**` covers everything else (hostnames,
  // *.local, etc.).
  allowedDevOrigins: ["**", "*", "*.*.*.*"],
  // The UI uses next/image once, with an SVG. Disabling the optimizer
  // skips bundling `sharp`, which has platform-specific native binaries
  // — important so the npm package works cross-platform via npx.
  images: { unoptimized: true },
  // Belt-and-braces: keep sharp and its libvips natives out of the
  // standalone trace so the published bundle stays portable.
  outputFileTracingExcludes: {
    "*": ["**/node_modules/sharp/**", "**/node_modules/@img/**"],
  },
};

export default nextConfig;
