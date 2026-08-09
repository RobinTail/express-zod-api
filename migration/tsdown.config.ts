import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };
import { fixDtsPlugin } from "../tools/fixDts.ts";

export default defineConfig({
  entry: "index.ts",
  fixedExtension: false,
  minify: true,
  deps: {
    neverBundle: true,
  },
  dts: {
    generator: "tsgo",
    tsconfig: "./tsconfig.build.json",
  },
  attw: { profile: "esm-only", level: "error" },
  plugins: [fixDtsPlugin()],
  define: {
    "process.env.TSDOWN_VERSION": `"${manifest.version}"`, // used by ruleName
  },
});
