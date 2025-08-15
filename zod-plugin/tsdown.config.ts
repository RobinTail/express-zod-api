import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "index.ts",
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
