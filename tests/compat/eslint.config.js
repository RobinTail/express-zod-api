import parser from "@typescript-eslint/parser";
import migration from "express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  { files: ["**/*.ts"], rules: { "migration/v21": "error" } },
];
