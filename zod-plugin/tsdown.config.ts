import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "index.ts",
    minify: true,
    attw: { profile: "esmOnly", level: "error" },
    banner: {
      dts: "import './augmentation.js';",
    },
  },
  {
    entry: "augmentation.ts",
    dts: { emitDtsOnly: true },
  },
]);
