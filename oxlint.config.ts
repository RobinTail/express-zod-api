import { defineConfig } from "oxlint";

// prefixed built-in modules covered by "unicorn/prefer-node-protocol" rule
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

export default defineConfig({
  jsPlugins: [
    { name: "allowed", specifier: "eslint-plugin-allowed-dependencies" },
    { name: "local", specifier: "./tools/custom-rules.ts" },
  ],
  categories: {
    correctness: "error",
  },
  env: {
    builtin: true,
    node: true,
  },
  ignorePatterns: ["**/dist/", "**/coverage/", "compat-test"],
  rules: {
    "unicorn/prefer-node-protocol": "warn",
    "constructor-super": "error",
    "for-direction": "error",
    "getter-return": "error",
    "no-async-promise-executor": "error",
    "no-case-declarations": "error",
    "no-class-assign": "error",
    "no-compare-neg-zero": "error",
    "no-cond-assign": "error",
    "no-const-assign": "error",
    "no-constant-binary-expression": "error",
    "no-constant-condition": "error",
    "no-control-regex": "error",
    "no-debugger": "error",
    "no-delete-var": "error",
    "no-dupe-class-members": "error",
    "no-dupe-else-if": "error",
    "no-dupe-keys": "error",
    "no-duplicate-case": "error",
    "no-empty": ["error", { allowEmptyCatch: true }],
    "no-empty-character-class": "error",
    "no-empty-pattern": ["error", { allowObjectPatternsAsParameters: true }],
    "no-empty-static-block": "error",
    "no-ex-assign": "error",
    "no-extra-boolean-cast": "error",
    "no-fallthrough": "error",
    "no-func-assign": "error",
    "no-global-assign": "error",
    "no-import-assign": "error",
    "no-invalid-regexp": "error",
    "no-irregular-whitespace": "error",
    "no-loss-of-precision": "error",
    "no-misleading-character-class": "error",
    "no-new-native-nonconstructor": "error",
    "no-nonoctal-decimal-escape": "error",
    "no-obj-calls": "error",
    "no-prototype-builtins": "error",
    "no-redeclare": "error",
    "no-regex-spaces": "error",
    "no-self-assign": "error",
    "no-setter-return": "error",
    "no-shadow-restricted-names": "error",
    "no-sparse-arrays": "error",
    "no-this-before-super": "error",
    "no-unassigned-vars": "error",
    "no-unexpected-multiline": "error",
    "no-unreachable": "error",
    "no-unsafe-finally": "error",
    "no-unsafe-negation": "error",
    "no-unsafe-optional-chaining": "error",
    "no-unused-labels": "error",
    "no-unused-private-class-members": "error",
    "no-unused-vars": "error",
    "no-useless-backreference": "error",
    "no-useless-catch": "error",
    "no-useless-escape": "error",
    "no-with": "error",
    "preserve-caught-error": "error",
    "require-yield": "error",
    "use-isnan": "error",
    "valid-typeof": "error",
    "no-array-constructor": "error",
    "no-unused-expressions": "error",
    curly: ["warn", "multi-or-nest", "consistent"],
    "no-duplicate-imports": "warn",
    "no-shadow": "warn",
    "typescript/ban-ts-comment": "error",
    "typescript/no-duplicate-enum-values": "error",
    "typescript/no-empty-object-type": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-extra-non-null-assertion": "error",
    "typescript/no-misused-new": "error",
    "typescript/no-namespace": "error",
    "typescript/no-non-null-asserted-optional-chain": "error",
    "typescript/no-require-imports": "error",
    "typescript/no-this-alias": "error",
    "typescript/no-unnecessary-type-constraint": "error",
    "typescript/no-unsafe-declaration-merging": "error",
    "typescript/no-unsafe-function-type": "error",
    "typescript/no-wrapper-object-types": "error",
    "typescript/prefer-as-const": "error",
    "typescript/prefer-namespace-keyword": "error",
    "typescript/triple-slash-reference": "error",
  },
  overrides: [
    {
      // ALL SOURCES
      files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
      rules: {
        "constructor-super": "off",
        "getter-return": "off",
        "no-class-assign": "off",
        "no-const-assign": "off",
        "no-dupe-class-members": "off",
        "no-dupe-keys": "off",
        "no-func-assign": "off",
        "no-import-assign": "off",
        "no-new-native-nonconstructor": "off",
        "no-obj-calls": "off",
        "no-redeclare": "off",
        "no-setter-return": "off",
        "no-this-before-super": "off",
        "no-unreachable": "off",
        "no-unsafe-negation": "off",
        "no-var": "error",
        "no-with": "off",
        "prefer-const": "error",
        "prefer-rest-params": "error",
        "prefer-spread": "error",
        "local/syntax": ["warn", ...importConcerns],
      },
    },
    {
      // FRAMEWORK SOURCES
      files: ["express-zod-api/src/*.ts"],
      rules: {
        complexity: ["error", 16],
        "allowed/dependencies": ["error", { packageDir: "express-zod-api" }],
        "local/syntax": ["warn", ...importConcerns, ...performanceConcerns],
      },
    },
    {
      // INTEGRATION GENERATOR
      files: [
        "express-zod-api/src/integration.ts",
        "express-zod-api/src/integration-base.ts",
        "express-zod-api/src/zts.ts",
      ],
      rules: {
        "local/syntax": [
          "warn",
          ...importConcerns,
          ...performanceConcerns,
          ...tsFactoryConcerns,
        ],
      },
    },
    {
      // ZOD PLUGIN
      files: ["zod-plugin/src/*.ts"],
      rules: {
        "allowed/dependencies": ["error", { packageDir: "zod-plugin" }],
        "local/syntax": ["warn", ...importConcerns, ...performanceConcerns],
      },
    },
    {
      // MIGRATION
      files: ["migration/index.ts", "migration/helpers.ts"],
      rules: {
        "allowed/dependencies": ["error", { packageDir: "migration" }],
      },
    },
    {
      // TESTS
      files: ["**/tests/*.ts", "**/vitest.setup.ts", "**/*.spec.ts"],
      rules: {
        "typescript/no-explicit-any": "off",
        "typescript/no-empty-object-type": "warn",
      },
    },
    {
      // GENERATED CODE
      files: ["*-test/quick-start.ts", "example/example.client.ts"],
      rules: {
        "no-duplicate-imports": "off",
        "typescript/no-explicit-any": "off",
        "typescript/no-empty-object-type": [
          "error",
          { allowObjectTypes: "always" },
        ],
      },
    },
  ],
});
