import { defineConfig, Options } from "tsup";
import { version } from "./package.json";

const commons: Options = {
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  minify: true,
};

const migration: Options = {
  ...commons,
  entry: { index: "src/migration.ts" },
  outDir: "migration",
};

export default defineConfig([
  {
    ...commons,
    format: ["cjs", "esm"],
    entry: ["src/index.ts"],
    esbuildOptions: (options, { format }) => {
      options.supported = {};
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
      };
    },
  },
  {
    ...migration,
    format: "esm",
  },
  {
    ...migration,
    format: "cjs",
    // @see https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/MissingExportEquals.md
    dts: { footer: `export = _default;` },
  },
]);
