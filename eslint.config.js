import globals from "globals";
import jsPlugin from "@eslint/js";
import tsPlugin from "typescript-eslint";
import prettierOverrides from "eslint-config-prettier";
import prettierRules from "eslint-plugin-prettier/recommended";
import unicornPlugin from "eslint-plugin-unicorn";
import allowedDepsPlugin from "eslint-plugin-allowed-dependencies";

export default [
  {
    languageOptions: { globals: globals.node },
    plugins: {
      unicorn: unicornPlugin,
      allowed: allowedDepsPlugin,
    },
  },
  jsPlugin.configs.recommended,
  ...tsPlugin.configs.recommended,
  prettierOverrides,
  prettierRules,
  { name: "globally/ignored", ignores: ["dist/", "coverage/", "migration/"] },
  {
    name: "globally/disabled",
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
    },
  },
  {
    name: "globally/enabled",
    rules: {
      curly: ["warn", "multi-or-nest", "consistent"],
      "unicorn/prefer-node-protocol": "error",
    },
  },
  {
    name: "source/all",
    files: ["src/*.ts"],
    rules: {
      "allowed/dependencies": ["error", { typeOnly: ["eslint", "prettier"] }],
      // "no-restricted-syntax": ["warn", "ReturnStatement[argument=null]"],
      "no-restricted-syntax": [
        "warn",
        {
          // https://github.com/RobinTail/express-zod-api/pull/2169
          selector: "ImportDeclaration[source.value=/assert/]",
          message: "assert is slow, use throw",
        },
        {
          // https://github.com/RobinTail/express-zod-api/pull/2168
          selector:
            "CallExpression > MemberExpression[object.name='Object'][property.name='entries']",
          message: "Object.entries() is 2x slower than R.toPairs()",
        },
        {
          // https://github.com/RobinTail/express-zod-api/pull/2160
          selector: "ObjectExpression > SpreadElement ~ SpreadElement",
          message: "Multiple spreading 1.4x slower than Object.assign()",
        },
      ],
    },
  },
  {
    name: "source/plugin",
    files: ["src/zod-plugin.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    name: "source/migration",
    files: ["src/migration.ts"],
    rules: {
      "allowed/dependencies": [
        "error",
        { ignore: ["^@typescript-eslint", "^\\."] },
      ],
    },
  },
  {
    name: "tests/all",
    files: ["tests/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
  {
    name: "generated/all",
    files: ["tests/*/quick-start.ts", "example/example.client.ts"],
    rules: {
      "prettier/prettier": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowObjectTypes: "always" },
      ],
    },
  },
];
