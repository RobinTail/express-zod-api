import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    pool: "threads",
    testTimeout: 10000,
    reporters: "verbose",
    setupFiles: join(
      dirname(fileURLToPath(import.meta.url)),
      "vitest.setup.ts",
    ),
    fakeTimers: {
      // vitest 3 mocks performance.now() by default which is used by BuiltinLogger and should not be affected
      toFake: ["setTimeout", "clearTimeout", "Date"],
    },
    coverage: {
      reporter: [["text", { maxCols: 120 }], "json-summary", "html", "lcov"],
      include: ["src/**"],
    },
  },
});
