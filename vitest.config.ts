import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 10000,
    reporters: "basic",
    coverage: {
      provider: "istanbul",
      reporter: ["json-summary", "text", "html", "lcov"],
      include: ["src/**"],
    },
  },
});
