import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "src/index.ts",
    minify: true,
    attw: { level: "error" },
    banner: {
      dts: "import './augmentation.js';",
    },
  },
  {
    entry: "src/augmentation.ts",
    dts: { emitDtsOnly: true },
  },
]);
