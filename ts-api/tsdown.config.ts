import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  fixedExtension: false,
  minify: true,
  attw: { profile: "esm-only", level: "error" },
});
