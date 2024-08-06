import { defineConfig, Options } from "tsup";
import { engines } from "./package.json";
import semver from "semver";

const minNode = semver.minVersion(engines.node)!;

const commons: Options = {
  format: "cjs",
  splitting: false,
  sourcemap: false,
  dts: false,
  minify: false,
  target: `node${minNode.major}.${minNode.minor}.${minNode.patch}`,
};

export default defineConfig({
  ...commons,
  entry: ["./tools/import-plugin.ts"],
  outDir: "tools",
  external: ["*"],
});
