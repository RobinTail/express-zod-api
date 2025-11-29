import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };

export default defineConfig([
  {
    entry: "src/index.ts",
    fixedExtension: false,
    minify: true,
    attw: { profile: "esm-only", level: "error" },
    banner: {
      dts: "import './augmentation.js';",
    },
    define: {
      "process.env.TSDOWN_SELF": `"${manifest.name}"`, // used by pluginFlag
    },
  },
  {
    entry: "src/augmentation.ts",
    fixedExtension: false,
    dts: { emitDtsOnly: true },
  },
]);
