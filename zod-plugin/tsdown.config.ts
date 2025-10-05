import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };

export default defineConfig([
  {
    entry: "src/index.ts",
    minify: true,
    attw: { profile: "esmOnly", level: "error" },
    banner: {
      dts: "import './augmentation.js';",
    },
    define: {
      "process.env.TSDOWN_SELF": `"${manifest.name}"`, // used by pluginFlag
    },
  },
  {
    entry: "src/augmentation.ts",
    dts: { emitDtsOnly: true },
  },
]);
