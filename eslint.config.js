import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import eslintPluginUnicorn from "eslint-plugin-unicorn";
import eslintImportX from "eslint-plugin-import-x";

export default [
  {
    languageOptions: { globals: globals.node },
    plugins: {
      unicorn: eslintPluginUnicorn,
      "import-x": eslintImportX,
    },
    settings: {
      "import-x/parsers": {
        "@typescript-eslint/parser": [".ts"],
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintPluginPrettierRecommended,
  // Things to turn off
  { ignores: ["dist/", "coverage/"] },
  {
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
      "@typescript-eslint/no-empty-object-type": "off", // @todo remove
      "@typescript-eslint/no-explicit-any": "off", // @todo remove
    },
  },
  // Things to turn on globally
  {
    rules: {
      "unicorn/prefer-node-protocol": "error",
      "import-x/named": "error",
      "import-x/export": "error",
      "import-x/no-duplicates": "warn",
    },
  },
  // For the sources
  {
    files: ["src/*.ts"],
    rules: {
      "import-x/no-extraneous-dependencies": "error",
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
    files: ["tests/*/quick-start.ts"],
    rules: {
      "prettier/prettier": "off",
      "import-x/no-duplicates": "off",
    },
  },
];
