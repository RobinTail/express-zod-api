import { defineConfig, Options } from "tsup";
import { version, engines, name } from "./package.json";
import semver from "semver";

const minNode = semver.minVersion(engines.node)!;

const commons: Options = {
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: false,
  clean: true,
  minify: true,
  target: `node${minNode.major}.${minNode.minor}.${minNode.patch}`,
  removeNodeProtocol: false, // @todo will be default in v9
};

export default defineConfig([
  {
    ...commons,
    shims: true, // used by BuiltinLogger
    dts: true,
    name,
    entry: ["src/index.ts"],
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
        "process.env.TSUP_EXT": `"${format === "esm" ? "js" : "cjs"}"`, // used by BuiltinLogger
      };
    },
  },
  {
    ...commons,
    name: "./worker".padStart(name.length),
    entry: ["src/worker.js"],
    esbuildOptions: (options, { format }) => {
      options.define = {
        "process.env.TSUP_FORMAT": `"${format.toUpperCase()}"`,
      };
    },
  },
  {
    ...commons,
    dts: true,
    name: "./migration".padStart(name.length),
    entry: { index: "src/migration.ts" },
    outDir: "migration",
    /**
     * This replaces "export { _default as default }" with "export = _default" in the CJS DTS build
     * @link https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/MissingExportEquals.md
     * */
    cjsInterop: true,
    skipNodeModulesBundle: true,
  },
]);
