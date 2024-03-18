import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";
import importPlugin from "eslint-plugin-import";
import unicornPlugin from "eslint-plugin-unicorn";
import tsParser from "@typescript-eslint/parser";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat();
const airBnbBase = compat.extends("airbnb-typescript/base");
const prettierBase = compat.extends("prettier");
const prettierRecommended = compat.extends("plugin:prettier/recommended");

export default [
  ...airBnbBase,
  ...prettierBase,
  ...prettierRecommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
      parser: tsParser,
      parserOptions: {
        project: true,
      },
    },
    plugins: {
      typescript: tsPlugin,
      prettier: prettierPlugin,
      import: importPlugin,
      unicorn: unicornPlugin,
    },
    rules: {
      "@typescript-eslint/lines-between-class-members": "off",
      "sort-imports": [
        "warn",
        {
          ignoreDeclarationSort: true,
        },
      ],
      "unicorn/prefer-node-protocol": "error",
    },
  },
  {
    files: ["tools/*.ts", "tests/**/*.ts", "tsup.config.ts", "example/*.ts"],
    rules: {
      "import/no-extraneous-dependencies": "off",
    },
  },
];
