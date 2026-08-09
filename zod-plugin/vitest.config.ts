import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import manifest from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    "import.meta.TSDOWN_SELF": `"${manifest.name}"`,
  },
  test: {
    globals: true,
    pool: "threads",
    testTimeout: 10000,
    setupFiles: join(
      dirname(fileURLToPath(import.meta.url)),
      "vitest.setup.ts",
    ),
  },
});
