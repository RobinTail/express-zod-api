// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from "tsup";
import fs from "fs";
import originalManifest from "./package.json";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs", "esm"],
  legacyOutput: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  onSuccess: async () => {
    const manifest = {
      type: "module",
      version: originalManifest.version, // for yarn in esm test
    };
    fs.writeFileSync(
      "./dist/esm/package.json",
      `${JSON.stringify(manifest)}\n`
    );
  },
});
