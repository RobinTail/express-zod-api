import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export default defineConfig({
  test: {
    env: {
      FORCE_COLOR: "1",
    },
    globals: true,
    pool: "threads",
    testTimeout: 10000,
    reporters: "basic",
    setupFiles: join(
      dirname(fileURLToPath(import.meta.url)),
      "vitest.setup.ts",
    ),
    coverage: {
      reporter: [["text", { maxCols: 120 }], "json-summary", "html", "lcov"],
      include: ["src/**"],
    },
  },
});
