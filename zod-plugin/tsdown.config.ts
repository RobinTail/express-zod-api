import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };
import { fixDtsPlugin } from "../tools/fixDts.ts";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    brand: "src/brand.ts",
  },
  fixedExtension: false,
  minify: true,
  attw: { profile: "esm-only", level: "error" },
  dts: {
    generator: "tsgo",
    tsconfig: "./tsconfig.build.json",
  },
  plugins: [fixDtsPlugin()],
  define: {
    "process.env.TSDOWN_SELF": `"${manifest.name}"`, // used by pluginFlag
  },
});
