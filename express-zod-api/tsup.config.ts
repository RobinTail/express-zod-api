import semver from "semver";
import { defineConfig } from "tsup";
import { commons } from "../tsup.base";
import { engines, version } from "./package.json";

const minNode = semver.minVersion(engines.node)!;

export default defineConfig({
  ...commons,
  entry: ["src/index.ts"],
  target: `node${minNode.major}.${minNode.minor}.${minNode.patch}`,
  esbuildOptions: (options, { format }) => {
    options.supported = options.supported || {};
    if (format === "cjs") {
      /**
       * Downgrade dynamic imports for CJS even they are actually supported, but still are problematic for Jest
       * @example jest with ts-jest
       * @link https://github.com/evanw/esbuild/issues/2651
       */
      options.supported["dynamic-import"] = false;
    }
    options.define = {
      "process.env.TSUP_BUILD": `"v${version} (${format.toUpperCase()})"`,
      "process.env.TSUP_STATIC": `"static"`, // used by isProduction()
    };
  },
});
