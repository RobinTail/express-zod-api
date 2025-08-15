import { defineConfig } from "tsdown";
import { version } from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  minify: true,
  attw: { profile: "esmOnly", level: "error" },
  define: {
    // @todo rename prefix to TSDOWN
    "process.env.TSUP_BUILD": `"v${version}"`, // @since v25.0.0 is pure ESM
    "process.env.TSUP_STATIC": `"static"`, // used by isProduction()
  },
});
