import { defineConfig } from "vitest/config";

const isIntegrationTest = process.argv.includes("-r");

export default defineConfig({
  test: {
    env: {
      FORCE_COLOR: "1",
    },
    testTimeout: 10000,
    reporters: "basic",
    coverage: {
      provider: "istanbul",
      reporter: [["text", { maxCols: 120 }], "json-summary", "html", "lcov"],
      include: ["src/**"],
    },
    setupFiles: isIntegrationTest ? [] : ["./vitest.setup.ts"],
  },
});
