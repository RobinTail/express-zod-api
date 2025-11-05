import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };

export default defineConfig({
  entry: "src/index.ts",
  fixedExtension: false,
  minify: true,
  attw: { profile: "esmOnly", level: "error" },
  define: {
    "process.env.TSDOWN_SELF": `"${manifest.name}"`, // used by localsID
    "process.env.TSDOWN_BUILD": `"v${manifest.version}"`, // @since v25.0.0 is pure ESM
    "process.env.TSDOWN_STATIC": `"static"`, // used by isProduction()
  },
});
