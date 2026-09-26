import { RuleTester } from "oxlint/plugins-dev";
import manifest from "./package.json";
import assert from "node:assert/strict";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

describe("Migration", async () => {
  const { default: migration } = await import("./index");
  const ruleName = `v${manifest.version.split(".")[0]}`;
  const theRule = migration.rules[ruleName as keyof typeof migration.rules];
  assert(theRule, "Rule not found");

  test("should consist of one rule being the major version of the package", () => {
    expect(migration.rules).toHaveProperty(ruleName);
    expect(migration).toMatchSnapshot();
  });

  tester.run(ruleName, theRule, {
    valid: [
      // expressZodApiImport
      `import { Documentation } from "express-zod-api/documentation"`,
      // defaultId
      `import { legacyResultHandler, legacyEndpointsFactory } from "express-zod-api"`,
      `const foo = new EndpointsFactory(legacyResultHandler)`,
      `const bar = legacyEndpointsFactory.build({})`,
      `const foo = new EndpointsFactory(defaultResultHandler)`, // no import
      `const defaultResultHandler = 1; defaultResultHandler`, // local variable
      `import { defaultResultHandler } from "other-module"; const f = new EndpointsFactory(defaultResultHandler)`,
      // createConfigCall
      `createConfig({ trySyncValidation: false })`,
      `createConfig({ trySyncValidation: true, cors: true })`,
    ],
    invalid: [
      {
        name: "import DocumentationError from main entrypoint",
        code: `import { DocumentationError } from "express-zod-api"`,
        output: `import { DocumentationError } from "express-zod-api/documentation"`,
        errors: [
          {
            messageId: "move",
            data: {
              subject: "DocumentationError",
              to: "express-zod-api/documentation",
            },
          },
        ],
      },
      {
        name: "split mixed import with DocumentationError and main",
        code: `import { DocumentationError, createConfig } from "express-zod-api"`,
        output: `import { createConfig } from "express-zod-api"\nimport { DocumentationError } from "express-zod-api/documentation"`,
        errors: [
          {
            messageId: "move",
            data: {
              subject: "DocumentationError",
              to: "express-zod-api/documentation",
            },
          },
        ],
      },
      {
        name: "change defaultResultHandler import",
        code: `import { defaultResultHandler } from "express-zod-api"`,
        output: `import { legacyResultHandler } from "express-zod-api"`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
        ],
      },
      {
        name: "change defaultEndpointsFactory import",
        code: `import { defaultEndpointsFactory } from "express-zod-api"`,
        output: `import { legacyEndpointsFactory } from "express-zod-api"`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
        ],
      },
      {
        name: "change both in mixed import",
        code: `import { defaultResultHandler, defaultEndpointsFactory } from "express-zod-api"`,
        output: `import { legacyResultHandler, legacyEndpointsFactory } from "express-zod-api"`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
        ],
      },
      {
        name: "change renamed entity and move in the same import",
        code: `import { defaultEndpointsFactory, DocumentationError } from "express-zod-api"; const f = defaultEndpointsFactory;`,
        output: `import { legacyEndpointsFactory } from "express-zod-api"\nimport { DocumentationError } from "express-zod-api/documentation"; const f = legacyEndpointsFactory;`,
        errors: [
          {
            messageId: "move",
            data: {
              subject: "DocumentationError",
              to: "express-zod-api/documentation",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
        ],
      },
      {
        name: "change defaultResultHandler in code usage",
        code: `import { defaultResultHandler } from "express-zod-api"; const f = new EndpointsFactory(defaultResultHandler)`,
        output: `import { legacyResultHandler } from "express-zod-api"; const f = new EndpointsFactory(legacyResultHandler)`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
        ],
      },
      {
        name: "change defaultResultHandler in nested code usage",
        code: `import { defaultResultHandler } from "express-zod-api"; function f() { return new EndpointsFactory(defaultResultHandler) }`,
        output: `import { legacyResultHandler } from "express-zod-api"; function f() { return new EndpointsFactory(legacyResultHandler) }`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
        ],
      },
      {
        name: "do not change non-reference identifiers",
        code: `import { defaultResultHandler } from "express-zod-api"; const obj = { defaultResultHandler: 1 }; obj.defaultResultHandler`,
        output: `import { legacyResultHandler } from "express-zod-api"; const obj = { defaultResultHandler: 1 }; obj.defaultResultHandler`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
        ],
      },
      {
        name: "change defaultEndpointsFactory in code usage",
        code: `import { defaultEndpointsFactory } from "express-zod-api"; const f = defaultEndpointsFactory.build({})`,
        output: `import { legacyEndpointsFactory } from "express-zod-api"; const f = legacyEndpointsFactory.build({})`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
          {
            messageId: "change",
            data: {
              subject: "entity",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
        ],
      },
      {
        name: "add trySyncValidation to empty createConfig",
        code: `createConfig({})`,
        output: `createConfig({\n  // @todo remove it when made sure that async refinements of your schemas do not have side effects sensitive to the calls count\n  trySyncValidation: false,})`,
        errors: [
          {
            messageId: "add",
            data: { subject: "trySyncValidation: false", to: "createConfig()" },
          },
        ],
      },
      {
        name: "add trySyncValidation to createConfig with existing properties",
        code: `createConfig({\n  cors: true,\n})`,
        output: `createConfig({\n  // @todo remove it when made sure that async refinements of your schemas do not have side effects sensitive to the calls count\n  trySyncValidation: false,\n  cors: true,\n})`,
        errors: [
          {
            messageId: "add",
            data: { subject: "trySyncValidation: false", to: "createConfig()" },
          },
        ],
      },
    ],
  });
});
