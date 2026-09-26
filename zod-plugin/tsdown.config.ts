import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };

declare global {
  interface ImportMeta {
    TSDOWN_SELF: string;
  }
}

export default defineConfig({
  entry: {
    index: "src/index.ts",
    brand: "src/brand.ts",
  },
  fixedExtension: false,
  minify: true,
  attw: { profile: "esm-only", level: "error" },
  inputOptions: { experimental: { attachDebugInfo: "none" } },
  dts: {
    generator: "tsgo",
    tsconfig: "./tsconfig.build.json",
  },
  define: {
    "import.meta.TSDOWN_SELF": `"${manifest.name}"`, // used by pluginFlag
  },
});
