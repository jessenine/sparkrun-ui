import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    // Component tests opt into jsdom via a `// @vitest-environment jsdom`
    // comment at the top of the .test.tsx file.
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts", "app/**/*.test.tsx"],
    // jest-dom matchers for component tests.
    setupFiles: ["./app/test/setup.ts"],
    // Live sparkrun CLI calls (compat suite) can take a while on
    // first run when registries are being fetched and cached.
    testTimeout: 60_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      reportsDirectory: "coverage",
      include: ["lib/**/*.ts", "app/components/**/*.tsx", "app/test/**/*.tsx"],
      exclude: [
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/node_modules/**",
        "lib/schemas.ts",
        "lib/rpc/server.ts",
        "lib/rpc/client.ts",
        "lib/event-bus.ts",
        "lib/types.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
