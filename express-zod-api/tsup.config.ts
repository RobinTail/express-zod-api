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
    /**
     * This is a patched feature for preserving the import of the plugin in DTS
     * @todo remove/rework if tsup upgrades hardcoded rollup-plugin-dts or merge the following PR:
     * @link https://github.com/egoist/tsup/pull/827
     * */
    treeshake: {
      moduleSideEffects: ["@express-zod-api/zod-plugin"],
    },
  } as unknown as true,
  esbuildOptions: (options) => {
    options.define = {
      "process.env.TSUP_BUILD": `"v${version}"`, // @since v25.0.0 is pure ESM
      "process.env.TSUP_STATIC": `"static"`, // used by isProduction()
    };
  },
});
