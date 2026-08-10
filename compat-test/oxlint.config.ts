import { defineConfig } from "oxlint";

export default defineConfig({
  jsPlugins: [{ name: "migration", specifier: "@express-zod-api/migration" }],
  overrides: [{ files: ["sample.ts"], rules: { "migration/v29": "error" } }],
});
