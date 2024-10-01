import { invoker, map } from "ramda";
import { defineConfig, Options } from "tsup";
import { version, engines, name } from "./package.json";
import semver from "semver";
import { renderUnicodeCompact } from "uqr";

const minNode = semver.minVersion(engines.node)!;

const toNumerics = (data: string) =>
  map(invoker(0, "charCodeAt"), data.split(""));

const qrOptions = { minVersion: 4, maxVersion: 4, boostEcc: true };
const qrDocs = toNumerics(
  renderUnicodeCompact(`https://ez.robintail.cz/v${version}`, qrOptions),
);
const qrGithub = toNumerics(
  renderUnicodeCompact(
    `https://github.com/RobinTail/express-zod-api/tree/v${version}`,
    qrOptions,
  ),
);

const commons: Options = {
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  minify: true,
  target: `node${minNode.major}.${minNode.minor}.${minNode.patch}`,
  removeNodeProtocol: false, // @todo will be default in v9
};

export default defineConfig([
  {
    ...commons,
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
        "process.env.TSUP_BUILD": JSON.stringify(
          `v${version} (${format.toUpperCase()})`,
        ),
        "process.env.DOCS_QR": JSON.stringify(qrDocs),
        "process.env.GITHUB_QR": JSON.stringify(qrGithub),
      };
    },
  },
  {
    ...commons,
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
