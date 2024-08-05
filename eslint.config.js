import globals from "globals";
import jsPlugin from "@eslint/js";
import tsPlugin from "typescript-eslint";
import prettierOverrides from "eslint-config-prettier";
import prettierRules from "eslint-plugin-prettier/recommended";
import unicornPlugin from "eslint-plugin-unicorn";
import manifest from "./package.json" with { type: "json" };
import { reject, startsWith, partition } from "ramda";

const excludeTypes = reject(startsWith("@types/"));
const allPeers = excludeTypes(Object.keys(manifest.peerDependencies));
const isOptional = (name) => manifest.peerDependenciesMeta[name]?.optional;
const [optPeers, reqPeers] = partition(isOptional, allPeers);
const production = Object.keys(manifest.dependencies);
const allowed = production.concat(reqPeers);
const typeOnly = optPeers.concat(["eslint", "prettier"]);

console.debug("Allowed imports", allowed);
console.debug("Type only imports", typeOnly);

export default [
  {
    languageOptions: { globals: globals.node },
    plugins: {
      unicorn: unicornPlugin,
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
    },
  },
  // For the sources
  {
    files: ["src/*.ts"],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          patterns: [{ regex: `^(?!\\.|node:)(?!${allowed.join("|")}).+$` }],
          paths: typeOnly.map((name) => ({ name, allowTypeImports: true })),
        },
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
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowObjectTypes: "always" },
      ],
    },
  },
];
