import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    env: {
      FORCE_COLOR: "1", // for logger test in CI
    },
    testTimeout: 10000,
    reporters: "basic",
    coverage: {
      provider: "istanbul",
      reporter: [["text", { maxCols: 120 }], "json-summary", "html", "lcov"],
      include: ["src/**"],
    },
  },
});
