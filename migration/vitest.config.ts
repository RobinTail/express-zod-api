import { defineConfig } from "vitest/config";
import manifest from "./package.json" with { type: "json" };

type Substitutions =
  `import.meta.${Extract<keyof ImportMeta, `TSDOWN_${string}`>}`;

export default defineConfig({
  define: {
    "import.meta.TSDOWN_VERSION": `"${manifest.version}"`,
  } satisfies Record<Substitutions, string>,
});
