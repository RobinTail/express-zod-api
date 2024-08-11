import parser from "@typescript-eslint/parser";
import migration from "express-zod-api/migration";

// @todo get rid of files here, make migration a pure plugin
export default [{ languageOptions: { parser }, files: ["*.ts"] }, migration];
