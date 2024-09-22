import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      FORCE_COLOR: "1",
    },
    globals: true,
    pool: "threads",
    testTimeout: 10000,
    reporters: "basic",
    setupFiles: "vitest.setup.ts",
    coverage: {
      provider: "istanbul",
      reporter: [["text", { maxCols: 120 }], "json-summary", "html", "lcov"],
      include: ["src/**"],
    },
  },
});
