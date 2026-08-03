import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };
import { fixDtsPlugin } from "../tools/fixDts.ts";

const plugins = [fixDtsPlugin()];

export default defineConfig({
  entry: "src/index.ts",
  fixedExtension: false,
  minify: true,
  attw: { profile: "esm-only", level: "error" },
  plugins,
  define: {
    "process.env.TSDOWN_SELF": `"${manifest.name}"`, // used by pluginFlag
  },
});
