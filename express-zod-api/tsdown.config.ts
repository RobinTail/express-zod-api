import { defineConfig } from "tsdown";
import manifest from "./package.json" with { type: "json" };
import { format, type Options } from "prettier";

const prettyOptions: Options = {
  parser: "typescript",
  printWidth: 120,
};

export default defineConfig({
  entry: "src/index.ts",
  fixedExtension: false,
  minify: true,
  attw: { profile: "esm-only", level: "error" },
  external: ["express-serve-static-core", "qs"],
  plugins: [
    {
      name: "human-readable-dts-rolldown-plugin",
      generateBundle: async (_opt, bundle) => {
        for (const [name, file] of Object.entries(bundle)) {
          if (!(name.endsWith(".d.ts") && "code" in file)) continue;
          file.code = await format(
            file.code
              .replaceAll(/(\/\*\*[^\r\n]*?\*\/)/g, "\n$1\n") // ensure newlines around jsdoc
              .replaceAll(/\n\s*\n/g, "\n"), // rm double newlines
            prettyOptions,
          );
        }
      },
    },
  ],
  define: {
    "process.env.TSDOWN_SELF": `"${manifest.name}"`, // used by localsID
    "process.env.TSDOWN_BUILD": `"v${manifest.version}"`, // @since v25.0.0 is pure ESM
    "process.env.TSDOWN_STATIC": `"static"`, // used by isProduction()
  },
});
