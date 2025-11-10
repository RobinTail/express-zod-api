import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };

export default defineConfig({
  entry: "index.ts",
  fixedExtension: false,
  minify: true,
  skipNodeModulesBundle: true,
  attw: { profile: "esmOnly", level: "error" },
  define: {
    "process.env.TSDOWN_VERSION": `"${manifest.version}"`, // used by ruleName
  },
});
