import semver from "semver";
import { defineConfig } from "tsup";
import { commons } from "../tsup.base";
import { engines, version } from "./package.json";

const minNode = semver.minVersion(engines.node)!;

export default defineConfig({
  ...commons,
  entry: ["src/index.ts"],
  target: `node${minNode.major}.${minNode.minor}.${minNode.patch}`,
  dts: {
    banner: `import "@express-zod-api/zod-plugin";`,
  },
  esbuildOptions: (options) => {
    options.define = {
      "process.env.TSUP_BUILD": `"v${version}"`, // @since v25.0.0 is pure ESM
      "process.env.TSUP_STATIC": `"static"`, // used by isProduction()
    };
  },
});
