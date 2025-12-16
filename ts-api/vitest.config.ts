import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    pool: "threads",
    testTimeout: 10000,
    passWithNoTests: true, // @todo remove
  },
});
