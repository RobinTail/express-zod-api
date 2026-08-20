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
    ],
  });
});
