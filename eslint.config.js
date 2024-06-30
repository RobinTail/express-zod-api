import globals from "globals";
import jsPlugin from "@eslint/js";
import tsPlugin from "typescript-eslint";
import prettierOverrides from "eslint-config-prettier";
import prettierRules from "eslint-plugin-prettier/recommended";
import unicornPlugin from "eslint-plugin-unicorn";
import importPlugin from "eslint-plugin-import";

export default [
  {
    languageOptions: { globals: globals.node },
    plugins: {
      unicorn: unicornPlugin,
      import: importPlugin,
    },
    settings: {
      // "import-x" plugin installed as "import", in order to suppress the warning from the typescript resolver
      // @link https://github.com/import-js/eslint-import-resolver-typescript/issues/293
      "import-x/resolver": { typescript: true, node: true },
    },
  },
  jsPlugin.configs.recommended,
  ...tsPlugin.configs.recommended,
  prettierOverrides,
  prettierRules,
  // Things to turn off globally
  { ignores: ["dist/", "coverage/", "migration/"] },
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
    },
  },
  // Things to turn on globally
  {
    rules: {
      "unicorn/prefer-node-protocol": "error",
      "import/named": "error",
      "import/export": "error",
      "import/no-duplicates": "warn",
    },
  },
  // For the sources
  {
    files: ["src/*.ts"],
    rules: {
      "import/no-extraneous-dependencies": "error",
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowWithName: "LoggerOverrides|Effected" },
      ],
    },
  },
  // For tests
  {
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": ["warn"],
    },
  },
  // Special needs of plugin
  {
    files: ["src/zod-plugin.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  // Special needs of the generated code
  {
    files: ["tests/*/quick-start.ts", "example/example.client.ts"],
    rules: {
      "prettier/prettier": "off",
      "import/no-duplicates": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowObjectTypes: "always" },
      ],
    },
  },
];
