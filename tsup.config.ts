import { defineConfig, Options } from "tsup";
import { version } from "./package.json";

const commons: Options = {
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  minify: true,
};

export default defineConfig([
  {
    ...commons,
    entry: ["src/index.ts"],
    esbuildOptions: (options, { format }) => {
      options.define = {
        "process.env.TSUP_BUILD": `"v${version} (${format.toUpperCase()})"`,
      };
    },
  },
  {
    ...commons,
    entry: { index: "src/migration.ts" },
    outDir: "migration",
    // @see https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/MissingExportEquals.md
    dts: { footer: `export = _default;` },
  },
]);
