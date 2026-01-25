import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };
import humanReadableDtsPlugin from "dts-plugin";

export default defineConfig({
  entry: "index.ts",
  fixedExtension: false,
  minify: true,
  skipNodeModulesBundle: true,
  attw: { profile: "esm-only", level: "error" },
  plugins: [humanReadableDtsPlugin()],
  define: {
    "process.env.TSDOWN_VERSION": `"${manifest.version}"`, // used by ruleName
  },
});
