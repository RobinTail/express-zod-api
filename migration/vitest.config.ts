import { defineConfig } from "vitest/config";
import manifest from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    "import.meta.TSDOWN_VERSION": `"${manifest.version}"`,
  },
});
