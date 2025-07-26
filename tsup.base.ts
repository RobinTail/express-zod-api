import type { Options } from "tsup";

export const commons: Options = {
  format: "esm",
  splitting: false,
  sourcemap: false,
  clean: true,
  dts: true,
  minify: true,
  removeNodeProtocol: false, // @todo will be default in v9
};
