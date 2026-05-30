import parser from "@typescript-eslint/parser";
import migration from "@express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  { files: ["sample.ts"], rules: { "migration/v28": "error" } },
];
