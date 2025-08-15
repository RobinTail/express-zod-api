import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "index.ts",
  skipNodeModulesBundle: true,
  attw: { profile: "esmOnly", level: "error" },
});
