import globals from "globals";
import jsPlugin from "@eslint/js";
import tsPlugin from "typescript-eslint";
import prettierOverrides from "eslint-config-prettier";
import prettierRules from "eslint-plugin-prettier/recommended";
import allowedDepsPlugin from "eslint-plugin-allowed-dependencies";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const packageDir = join(root, "express-zod-api");

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
    selector:
      "ImportDeclaration[source.value='ramda'] > ImportSpecifier, " +
      "ImportDeclaration[source.value='ramda'] > ImportDefaultSpecifier",
    message: "use import * as R from 'ramda'",
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
    selector: "Identifier[name='createCallExpression']",
    message: "use makeCall() helper",
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
    selector: "Identifier[name=/^create(TypeReference|KeywordType)Node$/]",
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
  {
    selector: "Identifier[name='createIndexedAccessTypeNode']",
    message: "use makeIndexed() helper",
  },
  {
    selector: "Identifier[name='createFunctionTypeNode']",
    message: "use makeFnType() helper",
  },
  {
    selector: "Identifier[name='createLiteralTypeNode']",
    message: "use makeLiteralType() helper",
  },
  {
    selector:
      "Identifier[name=/^create(NumericLiteral|StringLiteral|True|False|Null)$/]",
    message: "use literally() helper",
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
  prettierOverrides,
  prettierRules,
  {
    name: "globally/ignored",
    ignores: [
      "express-zod-api/dist/",
      "express-zod-api/coverage/",
      "express-zod-api/migration/",
    ],
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
    },
  },
  {
    name: "source/all",
    files: ["express-zod-api/src/*.ts"],
    rules: {
      "allowed/dependencies": [
        "error",
        { typeOnly: ["eslint", "prettier"], packageDir },
      ],
      "no-restricted-syntax": ["warn", ...performanceConcerns],
    },
  },
  {
    name: "source/plugin",
    files: ["express-zod-api/src/zod-plugin.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": "off",
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
        ...performanceConcerns,
        ...tsFactoryConcerns,
      ],
    },
  },
  {
    name: "source/migration",
    files: ["express-zod-api/src/migration.ts"],
    rules: {
      "allowed/dependencies": [
        "error",
        { ignore: ["^@typescript-eslint", "^\\."], packageDir },
      ],
    },
  },
  {
    name: "tests/all",
    files: ["express-zod-api/tests/*.ts", "express-zod-api/vitest.setup.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "warn",
    },
  },
  {
    name: "generated/all",
    files: ["*-test/quick-start.ts", "example/example.client.ts"],
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
