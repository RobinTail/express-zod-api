import { defineConfig } from "vitest/config";

/** @todo rename to .ts if/when moving to ESM first */
export default defineConfig({
  test: {
    pool: "threads",
    poolOptions: {
      threads: {
        isolate: false
      }
    },
    testTimeout: 10000,
    reporters: "basic",
    coverage: {
      enabled: true,
      provider: "istanbul",
      reporter: ["json-summary", "text", "html", "lcov"],
      include: ["src/**"]
    },
  },
});
