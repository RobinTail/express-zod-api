import { defineConfig } from "tsup";
import { writeFile } from "node:fs/promises";
import originalManifest from "./package.json";

/**
 * @todo get rid of build:dts command after the following issue fixed:
 * @link https://github.com/egoist/tsup/issues/938
 * @todo OR get rid of the legacyOutput, but for that the CI should have another job
 * */

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  legacyOutput: true,
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  minify: true,
  onSuccess: async () => {
    const manifest = {
      type: "module",
      version: originalManifest.version, // for yarn in esm test
    };
    await writeFile("./dist/esm/package.json", `${JSON.stringify(manifest)}\n`);
  },
});
