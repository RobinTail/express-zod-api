import { defineConfig } from "tsup";
import { version } from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  minify: true,
  esbuildOptions: (options, { format }) => {
    if (format === "cjs") {
      /**
       * Downgrade dynamic imports for CJS even they are actually supported, but still are problematic for Jest
       * @example jest with ts-jest
       * @link https://github.com/evanw/esbuild/issues/2651
       */
      options.supported = { ["dynamic-import"]: false };
    }
    options.define = {
      "process.env.TSUP_BUILD": `"v${version} (${format.toUpperCase()})"`,
    };
  },
});
