import globals from "globals";
import jsPlugin from "@eslint/js";
import tsPlugin from "typescript-eslint";
import allowedDepsPlugin from "eslint-plugin-allowed-dependencies";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { builtinModules } from "node:module";

const cwd = dirname(fileURLToPath(import.meta.url));
const ezDir = join(cwd, "express-zod-api");
const migrationDir = join(cwd, "migration");
const pluginDir = join(cwd, "zod-plugin");

const importConcerns = [
  {
    selector:
      "ImportDeclaration[source.value='ramda'] > ImportSpecifier, " +
      "ImportDeclaration[source.value='ramda'] > ImportDefaultSpecifier",
    message: "use import * as R from 'ramda'",
  },
  {
    selector: "ImportDeclaration[source.value=/^zod/] > ImportDefaultSpecifier",
    message: "do import { z } instead",
  },
  {
    selector: "ImportDeclaration[source.value=/\\.js$/]",
    message: "use .ts extension for relative imports",
  },
  {
    selector: "ImportDeclaration[source.value=/openapi3-ts\\/oas3(0|1)/]",
    message: "import from /oas32 instead",
  },
  {
    selector:
      "ImportDeclaration[source.value=/openapi3-ts/] > " +
      "ImportSpecifier[imported.name='SchemaObject']",
    message: "import SchemaObjectValue instead",
  },
  ...builtinModules.map((mod) => ({
    selector: `ImportDeclaration[source.value='${mod}']`,
    message: `use node:${mod} for the built-in module`,
  })),
];

const performanceConcerns = [
  {
    selector: "ImportDeclaration[source.value=/assert/]", // #2169
    message: "assert is slow, use throw",
  },
  {
    selector: "MemberExpression[object.name='process'][property.name='env']", // #2144
    message: "Reading process.env is slow and must be memoized",
  },
  {
    selector: "MemberExpression[object.name='R'] > Identifier[name='toPairs']", // #2168
    message: "R.toPairs() is 1.1x slower than Object.entries()",
  },
  {
    selector:
      "MemberExpression[object.name='R'] > Identifier[name='keys'], " +
      "MemberExpression[object.name='R'] > Identifier[name='keysIn']", // #2168
    message: "R.keys() and keysIn() are 1.2x slower than Object.keys()",
  },
  {
    selector: "CallExpression[callee.property.name='flatMap']", // #2209
    message: "flatMap() is about 1.3x slower than R.chain()",
  },
  {
    selector: "MemberExpression[object.name='R'] > Identifier[name='union']", // #2599
    message: "R.union() is 1.5x slower than [...Set().add()]",
  },
  {
    selector: "ImportDeclaration[source.value=/package.json$/]", // #2974
    message: "it can not be tree shaken, use tsdown and process.env instead",
  },
  {
    selector: "CallExpression[callee.property.name=/^(shift|unshift)$/]", // #3343
    message: "shifting is 2-20x slower than index-based iteration",
  },
  {
    selector:
      "CallExpression > MemberExpression[property.name='map'] > ArrayExpression > SpreadElement",
    message: "Set::values().map() would be 5% faster and more memory efficient",
  },
];

const tsFactoryConcerns = [
  {
    selector: "Identifier[name='createPropertySignature']",
    message: "use makeInterfaceProp()",
  },
  {
    selector: "Identifier[name=/^create(TypeReference|KeywordType)Node$/]",
    message: "use ensureTypeNode()",
  },
  {
    selector: "Identifier[name='createLiteralTypeNode']",
    message: "use makeLiteralType()",
  },
  {
    selector:
      "Identifier[name=/^create(NumericLiteral|StringLiteral|True|False|Null)$/]",
    message: "use literally()",
  },
  {
    selector: "Identifier[name='createUnionTypeNode']",
    message: "use makeUnion()",
  },
  {
    selector: "Identifier[name='createIdentifier']",
    message: "use makeId()",
  },
];

export default tsPlugin.config(
  {
    languageOptions: { globals: globals.node },
    plugins: {
      allowed: allowedDepsPlugin,
    },
  },
  jsPlugin.configs.recommended,
  tsPlugin.configs.recommended,
  {
    name: "globally/ignored",
    ignores: ["**/dist/", "**/coverage/", "compat-test"],
  },
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
      "@typescript-eslint/no-shadow": "warn",
      "no-restricted-syntax": ["warn", ...importConcerns],
      "no-duplicate-imports": "warn",
    },
  },
  {
    name: "source/ez",
    files: ["express-zod-api/src/*.ts"],
    rules: {
      complexity: ["error", 16],
      "allowed/dependencies": ["error", { packageDir: ezDir }],
      "no-restricted-syntax": [
        "warn",
        ...importConcerns,
        ...performanceConcerns,
      ],
    },
  },
  {
    name: "source/plugin",
    files: ["zod-plugin/src/*.ts"],
    rules: {
      "allowed/dependencies": ["error", { packageDir: pluginDir }],
      "no-restricted-syntax": [
        "warn",
        ...importConcerns,
        ...performanceConcerns,
      ],
    },
  },
  {
    name: "source/migration",
    files: ["migration/index.ts", "migration/helpers.ts"],
    rules: {
      "allowed/dependencies": ["error", { packageDir: migrationDir }],
      "no-restricted-syntax": ["warn", ...importConcerns],
    },
  },
  {
    name: "source/integration",
    files: [
      "express-zod-api/src/integration.ts",
      "express-zod-api/src/integration-base.ts",
      "express-zod-api/src/zts.ts",
    ],
    rules: {
      "no-restricted-syntax": [
        "warn",
        ...importConcerns,
        ...performanceConcerns,
        ...tsFactoryConcerns,
      ],
    },
  },
  {
    name: "tests/all",
    files: ["**/tests/*.ts", "**/vitest.setup.ts", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
  {
    name: "generated/all",
    files: ["*-test/quick-start.ts", "example/example.client.ts"],
    rules: {
      "no-duplicate-imports": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": [
        "error",
        { allowObjectTypes: "always" },
      ],
    },
  },
);
