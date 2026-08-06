import { parser } from "typescript-eslint";
import migration from "@express-zod-api/migration";

export default [
  { languageOptions: { parser }, plugins: { migration } },
  { files: ["sample.ts"], rules: { "migration/v29": "error" } },
];
