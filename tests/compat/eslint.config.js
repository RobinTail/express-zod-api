import parser from "@typescript-eslint/parser";
import migration from "express-zod-api/migration";

export default [{ languageOptions: { parser } }, migration];
