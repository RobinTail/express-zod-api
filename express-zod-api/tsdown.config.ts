import { defineConfig } from "tsdown";
import { readFile } from "node:fs/promises";

const { version } = JSON.parse(await readFile("./package.json", "utf8"));

export default defineConfig({
  entry: "src/index.ts",
  attw: { profile: "esmOnly", level: "error" },
  define: {
    "process.env.TSDOWN_BUILD": `"v${version}"`, // @since v25.0.0 is pure ESM
    "process.env.TSDOWN_STATIC": `"static"`, // used by isProduction()
  },
});
