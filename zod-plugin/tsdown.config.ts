import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };
import { fixDtsPlugin } from "../tools/fixDts";

const plugins = [fixDtsPlugin()];

export default defineConfig([
  {
    entry: "src/index.ts",
    fixedExtension: false,
    minify: true,
    attw: { profile: "esm-only", level: "error" },
    plugins,
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
    plugins,
  },
]);
