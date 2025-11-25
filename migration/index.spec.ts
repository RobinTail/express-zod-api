import { RuleTester } from "@typescript-eslint/rule-tester";
import { parser } from "typescript-eslint";
import manifest from "./package.json";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parser },
});

describe("Migration", async () => {
  vi.stubEnv("TSDOWN_VERSION", manifest.version);
  const { default: migration } = await import("./");
  const ruleName = `v${manifest.version.split(".")[0]}`;
  const theRule = migration.rules[ruleName as keyof typeof migration.rules];

  test("should consist of one rule being the major version of the package", () => {
    expect(migration.rules).toHaveProperty(ruleName);
    expect(migration).toMatchSnapshot();
  });

  tester.run(ruleName, theRule, {
    valid: [
      `const routing = { get: someEndpoint };`,
      `factory.build({ handler: async ({ ctx }) => {} });`,
      `factory.addContext();`,
      `new Middleware({ handler: async ({ ctx }) => {} });`,
      `new ResultHandler({ handler: ({ ctx }) => {} });`,
      `testMiddleware({ ctx: {} });`,
    ],
    invalid: [
      {
        name: "basic DependsOnMethod",
        code: `const routing = new DependsOnMethod({ get: someEndpoint });`,
        output: `const routing = {\nget: someEndpoint,\n};`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "value",
              from: "new DependsOnMethod(...)",
              to: "its argument",
            },
          },
        ],
      },
      {
        name: "DependsOnMethod with literals",
        code: `const routing = new DependsOnMethod({ "get": someEndpoint });`,
        output: `const routing = {\nget: someEndpoint,\n};`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "value",
              from: "new DependsOnMethod(...)",
              to: "its argument",
            },
          },
        ],
      },
      {
        name: "deprecated DependsOnMethod",
        code: `const routing = new DependsOnMethod({ get: someEndpoint }).deprecated();`,
        output: `const routing = {\nget: someEndpoint.deprecated(),\n};`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "value",
              from: "new DependsOnMethod(...)",
              to: "its argument",
            },
          },
        ],
      },
      {
        name: "DependsOnMethod with nesting",
        code: `const routing = new DependsOnMethod({ get: someEndpoint }).nest({ some: otherEndpoint });`,
        output: `const routing = {\nget: someEndpoint,\nsome: otherEndpoint,\n};`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "value",
              from: "new DependsOnMethod(...)",
              to: "its argument",
            },
          },
        ],
      },
      {
        name: "DependsOnMethod both deprecated and with nesting",
        code: `const routing = new DependsOnMethod({ get: someEndpoint }).deprecated().nest({ "get some": otherEndpoint });`,
        output: `const routing = {\nget: someEndpoint.deprecated(),\n"get some": otherEndpoint,\n};`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "value",
              from: "new DependsOnMethod(...)",
              to: "its argument",
            },
          },
        ],
      },
      {
        name: "options in handler",
        code: `factory.build({ handler: async ({ options }) => {} });`,
        output: `factory.build({ handler: async ({ ctx }) => {} });`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "options", to: "ctx" },
          },
        ],
      },
      {
        name: "renamed options in handler",
        code: `new Middleware({ handler: async ({ options: ttt }) => {} });`,
        output: `new Middleware({ handler: async ({ ctx: ttt }) => {} });`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "options", to: "ctx" },
          },
        ],
      },
      {
        name: "destructed options in handler",
        code: `new ResultHandler({ handler: ({ options: { method } }) => {} });`,
        output: `new ResultHandler({ handler: ({ ctx: { method } }) => {} });`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "options", to: "ctx" },
          },
        ],
      },
      {
        name: "addOptions method",
        code: `factory.addOptions(() => {});`,
        output: `factory.addContext(() => {});`,
        errors: [
          {
            messageId: "change",
            data: { subject: "method", from: "addOptions", to: "addContext" },
          },
        ],
      },
      {
        name: "testMiddleware options property",
        code: `testMiddleware({ options: {} });`,
        output: `testMiddleware({ ctx: {} });`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "options", to: "ctx" },
          },
        ],
      },
    ],
  });
});
