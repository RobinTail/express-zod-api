// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  legacyOutput: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  dts: true,
});
