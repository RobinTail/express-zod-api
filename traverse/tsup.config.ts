import { defineConfig } from "tsup";
import { commons } from "../tsup.base";

export default defineConfig({
  ...commons,
  entry: ["./index.ts"],
});
