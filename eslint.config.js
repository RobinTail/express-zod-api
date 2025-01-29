import globals from "globals";
import jsPlugin from "@eslint/js";
import tsPlugin from "typescript-eslint";
import prettierOverrides from "eslint-config-prettier";
import prettierRules from "eslint-plugin-prettier/recommended";
import unicornPlugin from "eslint-plugin-unicorn";
import allowedDepsPlugin from "eslint-plugin-allowed-dependencies";

const peformanceConcerns = [
  {
    selector: "ImportDeclaration[source.value=/assert/]", // #2169
    message: "assert is slow, use throw",
  },
  {
    selector: "MemberExpression[object.name='process'][property.name='env']", // #2144
    message: "Reading process.env is slow and must be memoized",
  },
  {
    selector: "CallExpression > Identifier[name='toPairs']", // #2168
    message: "R.toPairs() is 1.1x slower than Object.entries()",
  },
  {
    selector:
      "CallExpression[callee.name='keys'], CallExpression[callee.name='keysIn']", // #2168
    message: "R.keys() and keysIn() are 1.2x slower than Object.keys()",
  },
  {
    selector: "CallExpression[callee.property.name='flatMap']", // #2209
    message: "flatMap() is about 1.3x slower than R.chain()",
  },
];

const tsFactoryConcerns = [
  {
    selector: "Identifier[name='createConditionalExpression']",
    message: "use makeTernary() helper",
  },
  {
    selector: "Identifier[name='createArrowFunction']",
    message: "use makeArrowFn() helper",
  },
  {
    selector: "Identifier[name='createTypeParameterDeclaration']",
    message: "use makeTypeParams() helper",
  },
  {
    selector: "Identifier[name='createInterfaceDeclaration']",
    message: "use makeInterface() helper",
  },
  {
    selector: "Identifier[name='createClassDeclaration']",
    message: "use makePublicClass() helper",
  },
  {
    selector: "Identifier[name='createMethodDeclaration']",
    message: "use makePublicMethod() helper",
  },
  {
    selector: "Identifier[name='createTypeAliasDeclaration']",
    message: "use makeType() or makePublicLiteralType() helpers",
  },
  {
    selector: "Identifier[name='createVariableStatement']",
    message: "use makeConst() helper",
  },
  {
    selector: "Identifier[name='createArrayBindingPattern']",
    message: "use makeDeconstruction() helper",
  },
  {
    selector: "Identifier[name='createPropertySignature']",
    message: "use makeInterfaceProp() helper",
  },
  {
    selector: "Identifier[name='createConstructorDeclaration']",
    message: "use makePublicConstructor() helper",
  },
  {
    selector: "Identifier[name='createParameterDeclaration']",
    message: "use makeParam() or makeParams() helpers",
  },
  {
    selector:
      "CallExpression[callee.property.name='createCallExpression']" +
      "[arguments.0.callee.property.name='createPropertyAccessExpression']",
    message: "use makePropCall() helper",
  },
  {
    selector: "Identifier[name='KeyOfKeyword']",
    message: "use makeKeyOf() helper",
  },
  {
    selector: "Identifier[name='createTemplateExpression']",
    message: "use makeTemplate() helper",
  },
  {
    selector: "Identifier[name='createNewExpression']",
    message: "use makeNew() helper",
  },
  {
    selector: "Literal[value='Promise']",
    message: "use makePromise() helper",
  },
  {
    selector:
      "CallExpression[callee.property.name='createTypeReferenceNode'][arguments.length=1]",
    message: "use ensureTypeNode() helper",
  },
  {
    selector: "Identifier[name='createKeywordTypeNode']",
    message: "use ensureTypeNode() helper",
  },
  {
    selector: "Literal[value='Extract']",
    message: "use makeExtract() helper",
  },
  {
    selector: "Identifier[name='EqualsToken']",
    message: "use makeAssignment() helper",
  },
];

export default tsPlugin.config(
  {
    languageOptions: { globals: globals.node },
    plugins: {
      unicorn: unicornPlugin,
      allowed: allowedDepsPlugin,
    },
  },
  jsPlugin.configs.recommended,
  tsPlugin.configs.recommended,
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
      "@typescript-eslint/no-shadow": "warn",
    },
  },
  {
    name: "source/all",
    files: ["src/*.ts"],
    rules: {
      "allowed/dependencies": ["error", { typeOnly: ["eslint", "prettier"] }],
      "no-restricted-syntax": ["warn", ...peformanceConcerns],
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
    name: "source/integration",
    files: ["src/integration.ts", "src/integration-base.ts", "src/zts.ts"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        ...peformanceConcerns,
        ...tsFactoryConcerns,
      ],
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
);
