import globals from "globals";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import prettierPlugin from "eslint-plugin-prettier";
import importPlugin from "eslint-plugin-import";
import unicornPlugin from "eslint-plugin-unicorn";
import tsParser from "@typescript-eslint/parser";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat();

export default [
  ...compat.extends("airbnb-typescript/base"),
  ...compat.extends("prettier"),
  ...compat.extends("plugin:prettier/recommended"),
  {
    files: ["**/*.ts", "eslint.config.js"],
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
      "sort-imports": ["warn", { ignoreDeclarationSort: true }],
      "unicorn/prefer-node-protocol": "error",
    },
  },
  {
    files: [
      "tools/*.ts",
      "tests/**/*.ts",
      "tsup.config.ts",
      "example/*.ts",
      "eslint.config.js",
    ],
    rules: {
      "import/no-extraneous-dependencies": "off",
    },
  },
];
