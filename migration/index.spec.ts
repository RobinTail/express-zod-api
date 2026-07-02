import { RuleTester } from "@typescript-eslint/rule-tester";
import { parser } from "typescript-eslint";
import manifest from "./package.json";
import assert from "node:assert/strict";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parser },
});

describe("Migration", async () => {
  vi.stubEnv("TSDOWN_VERSION", manifest.version);
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
      // integrationCreate
      `new Integration({})`,
      `new Integration({ routing, config })`,
      // createServerAwait
      `createServer({})`,
      `const {} = createServer({})`,
      `const { app } = createServer({})`,
      // asyncLifecycleHook
      `createConfig({ beforeRouting: ({ app, logger }) => {} })`,
      `createConfig({ afterRouting: ({ app, logger }) => {} })`,
      `createConfig({ beforeRouting: ({ app, logger }) => {}, afterRouting: ({ app, logger }) => {} })`,
      // documentationConfig
      `new Documentation({ info: { title: "x", version: "y" }, server: "https://", routing, config })`,
      `new Documentation({ info: { }, server: "https://", routing, config })`,
      `new Documentation({ routing, config })`,
      // corsConfig
      `createConfig({ cors: true })`,
      `createConfig({ cors: someHandler })`,
      `createConfig({ cors: (req, res, next) => { someCors(req, res); next(); } })`,
    ],
    invalid: [
      {
        name: "integrationCreate",
        code: `await Integration.create({})`,
        output: `new Integration({})`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "Integration.create()",
              from: "await Integration.create()",
              to: "new Integration()",
            },
          },
        ],
      },
      {
        name: "integrationCreate with args",
        code: `await Integration.create({ routing, config })`,
        output: `new Integration({ routing, config })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "Integration.create()",
              from: "await Integration.create()",
              to: "new Integration()",
            },
          },
        ],
      },
      {
        name: "createServer await with variable",
        code: `const {} = await createServer({})`,
        output: `const {} = createServer({})`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "await from createServer()" },
          },
        ],
      },
      {
        name: "createServer await standalone",
        code: `await createServer({})`,
        output: `createServer({})`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "await from createServer()" },
          },
        ],
      },
      {
        name: "beforeRouting async arrow",
        code: `createConfig({ beforeRouting: async ({ app, logger }) => {} })`,
        output: `createConfig({ beforeRouting: ({ app, logger }) => {} })`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "async from beforeRouting" },
          },
        ],
      },
      {
        name: "afterRouting async function expression",
        code: `createConfig({ afterRouting: async function({ app }) {} })`,
        output: `createConfig({ afterRouting: function({ app }) {} })`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "async from afterRouting" },
          },
        ],
      },
      {
        name: "documentation title, version, and serverUrl",
        code: `new Documentation({ title: "x", version: "y", serverUrl: "https://", routing, config })`,
        output: `new Documentation({ info: { title: "x", version: "y" }, server: "https://", routing, config })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "Documentation",
              from: "title, version, serverUrl",
              to: "info, server",
            },
          },
        ],
      },
      {
        name: "documentation title and version only",
        code: `new Documentation({ title: "x", version: "y", routing, config })`,
        output: `new Documentation({ info: { title: "x", version: "y" }, routing, config })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "Documentation",
              from: "title, version",
              to: "info",
            },
          },
        ],
      },
      {
        name: "documentation serverUrl only",
        code: `new Documentation({ serverUrl: "https://", routing, config })`,
        output: `new Documentation({ server: "https://", routing, config })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "Documentation",
              from: "serverUrl",
              to: "server",
            },
          },
        ],
      },
      {
        name: "cors concise arrow returning object",
        code: `createConfig({ cors: () => ({ "access-control-allow-origin": "*" }) })`,
        output: `createConfig({ cors: (req, res, next) => { res.set({ "access-control-allow-origin": "*" }); next(); } })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "cors headers provider",
              from: "function returning object",
              to: "request handler",
            },
          },
        ],
      },
      {
        name: "cors arrow with params returning object",
        code: `createConfig({ cors: (request, response) => ({ "access-control-allow-origin": "*" }) })`,
        output: `createConfig({ cors: (req, res, next) => { res.set({ "access-control-allow-origin": "*" }); next(); } })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "cors headers provider",
              from: "function returning object",
              to: "request handler",
            },
          },
        ],
      },
      {
        name: "cors async concise arrow returning object",
        code: `createConfig({ cors: async () => ({ "access-control-allow-origin": "*" }) })`,
        output: `createConfig({ cors: (req, res, next) => { res.set({ "access-control-allow-origin": "*" }); next(); } })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "cors headers provider",
              from: "function returning object",
              to: "request handler",
            },
          },
        ],
      },
      {
        name: "cors arrow with block body returning object",
        code: `createConfig({ cors: () => { return { "access-control-allow-origin": "*" }; } })`,
        output: `createConfig({ cors: (req, res, next) => {\nres.set({ "access-control-allow-origin": "*" });\nnext();\n} })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "cors headers provider",
              from: "function returning object",
              to: "request handler",
            },
          },
        ],
      },
      {
        name: "cors async arrow with block body returning object",
        code: `createConfig({ cors: async () => { return { "access-control-allow-origin": "*" }; } })`,
        output: `createConfig({ cors: async (req, res, next) => {\nres.set({ "access-control-allow-origin": "*" });\nnext();\n} })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "cors headers provider",
              from: "function returning object",
              to: "request handler",
            },
          },
        ],
      },
      {
        name: "cors arrow with block body and preceding statements",
        code: `createConfig({ cors: () => { doSomething(); return { "access-control-allow-origin": "*" }; } })`,
        output: `createConfig({ cors: (req, res, next) => {\ndoSomething();\nres.set({ "access-control-allow-origin": "*" });\nnext();\n} })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "cors headers provider",
              from: "function returning object",
              to: "request handler",
            },
          },
        ],
      },
    ],
  });
});
