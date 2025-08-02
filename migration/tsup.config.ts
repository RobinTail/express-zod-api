import { defineConfig } from "tsup";
import { commons } from "../tsup.base";

export default defineConfig({
  ...commons,
  entry: ["index.ts"],
  /**
   * This replaces "export { _default as default }" with "export = _default" in the CJS DTS build
   * @link https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/MissingExportEquals.md
   * */
  cjsInterop: true,
  skipNodeModulesBundle: true,
});
