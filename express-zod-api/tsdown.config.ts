import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };
import { humanReadableDtsPlugin } from "../tools/readableDts.ts";

export default defineConfig({
  entry: "src/index.ts",
  fixedExtension: false,
  minify: true,
  attw: { profile: "esm-only", level: "error" },
  deps: {
    neverBundle: ["express-serve-static-core", "qs"],
  },
  banner: {
    /** @since tsdown 0.21 it shakes the unused import */
    dts: `import "@express-zod-api/zod-plugin";`,
  },
  plugins: [humanReadableDtsPlugin()],
  define: {
    "process.env.TSDOWN_SELF": `"${manifest.name}"`, // used by localsID
    "process.env.TSDOWN_BUILD": `"v${manifest.version}"`, // @since v25.0.0 is pure ESM
    "process.env.TSDOWN_STATIC": `"static"`, // used by isProduction()
  },
});
