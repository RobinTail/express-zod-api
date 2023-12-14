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
    options.define = {
      "process.env.TSUP_BUILD": `"v${version} (${format.toUpperCase()})"`,
    };
  },
});
