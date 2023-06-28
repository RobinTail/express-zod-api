// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from "tsup";
import { writeFile } from "node:fs/promises";
import originalManifest from "./package.json";

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
