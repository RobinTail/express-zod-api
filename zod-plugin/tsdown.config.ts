import { defineConfig } from "tsdown";

export default defineConfig([
  {
    entry: "src/index.ts",
    /**
     * Must emit CJS to require(zod) for consumers using CJS
     * @link https://github.com/RobinTail/express-zod-api/issues/2981
     * */
    format: ["esm", "cjs"],
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
