import { renameSync, statSync } from "node:fs";
import { defineConfig, Options } from "tsup";
import { version } from "./package.json";
import { waitFor } from "./tests/helpers";

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
    ...commons,
    entry: ["src/migration.ts"],
    outDir: "migration",
    onSuccess: async () => {
      for (const ext of ["js", "d.ts", "cjs", "d.cts"]) {
        const subject = `migration/migration.${ext}`;
        await waitFor(
          () => statSync(subject, { throwIfNoEntry: false })?.isFile() || false,
        );
        renameSync(subject, `migration/index.${ext}`);
        console.log(subject);
      }
    },
  },
]);
