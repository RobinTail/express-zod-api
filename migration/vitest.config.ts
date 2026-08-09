import { defineConfig } from "oxfmt";
import manifest from "./package.json" with { type: "json" };

export default defineConfig({
  define: {
    "import.meta.TSDOWN_VERSION": `"${manifest.version}"`,
  },
});
