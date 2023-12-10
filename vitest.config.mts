import { defineConfig } from "vitest/config";

/** @todo rename to .ts if/when moving to ESM first */
export default defineConfig({
  test: {
    testTimeout: 10000,
    coverage: {
      enabled: true,
      provider: "istanbul",
      reporter: ["json-summary", "text", "html", "lcov"],
      include: ["src/**"]
    },
  },
});
