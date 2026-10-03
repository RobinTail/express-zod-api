import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };

declare global {
  interface ImportMeta {
    TSDOWN_VERSION: string;
  }
}

export default defineConfig({
  entry: "index.ts",
  fixedExtension: false,
  minify: true,
  deps: {
    neverBundle: true,
  },
  inputOptions: { experimental: { attachDebugInfo: "none" } },
  dts: {
    generator: "tsgo",
    tsconfig: "./tsconfig.build.json",
  },
  attw: { profile: "esm-only", level: "error" },
  define: {
    "import.meta.TSDOWN_VERSION": `"${manifest.version}"`, // used by ruleName
  },
});
