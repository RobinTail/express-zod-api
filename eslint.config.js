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
          // https://github.com/RobinTail/express-zod-api/pull/2144
          selector:
            "MemberExpression[object.name='process'][property.name='env']",
          message: "Reading process.env is slow and must be memoized",
        },
        {
          // https://github.com/RobinTail/express-zod-api/pull/2168
          selector: "CallExpression > Identifier[name='toPairs']",
          message: "R.toPairs() is 1.1x slower than Object.entries()",
        },
        {
          // https://github.com/RobinTail/express-zod-api/pull/2168
          selector:
            "CallExpression[callee.name='keys'], CallExpression[callee.name='keysIn']",
          message: "R.keys() and keysIn() are 1.2x slower than Object.keys()",
        },
        {
          // https://github.com/RobinTail/express-zod-api/pull/2209
          selector: "CallExpression[callee.property.name='flatMap']",
          message: "flatMap() is about 1.3x slower than R.chain()",
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
    files: ["tests/**/*.ts", "vitest.setup.ts"],
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
