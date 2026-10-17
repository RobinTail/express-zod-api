import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };

declare global {
  interface ImportMeta {
    TSDOWN_SELF: string;
    TSDOWN_BUILD: string;
  }
}

export default defineConfig({
  entry: {
    index: "src/index.ts",
    integration: "src/integration.ts",
    documentation: "src/documentation.ts",
  },
  fixedExtension: false,
  minify: true,
  attw: { profile: "esm-only", level: "error" },
  inputOptions: { experimental: { attachDebugInfo: "none" } },
  deps: {
    dts: {
      neverBundle: ["express-serve-static-core", "qs"],
    },
  },
  dts: {
    generator: "tsgo",
    tsconfig: "./tsconfig.build.json",
  },
  define: {
    "import.meta.TSDOWN_SELF": `"${manifest.name}"`, // used by localsID
    "import.meta.TSDOWN_BUILD": `"v${manifest.version}"`, // @since v25.0.0 is pure ESM
  },
});
