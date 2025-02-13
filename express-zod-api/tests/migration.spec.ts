import { RuleTester } from "@typescript-eslint/rule-tester";
import migration from "../src/migration";
import parser from "@typescript-eslint/parser";
import { version } from "../package.json";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parser },
});

describe("Migration", () => {
  test("should consist of one rule being the major version of the package", () => {
    expect(migration.rules).toHaveProperty(`v${version.split(".")[0]}`);
    expect(migration).toMatchSnapshot();
  });

  tester.run("v23", migration.rules.v23, {
    valid: [
      `import { HeaderSecurity } from "express-zod-api";`,
      `createConfig({ wrongMethodBehavior: 405 });`,
      `endpoint.description`,
      `endpoint.shortDescription`,
      `endpoint.inputSchema`,
      `endpoint.outputSchema`,
      `endpoint.methods`,
      `endpoint.tags`,
      `endpoint.scopes`,
      `endpoint.security`,
      `endpoint.requestType`,
    ],
    invalid: [
      {
        code: `const security: CustomHeaderSecurity = {};`,
        output: `const security: HeaderSecurity = {};`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "interface",
              from: "CustomHeaderSecurity",
              to: "HeaderSecurity",
            },
          },
        ],
      },
      {
        code: `createConfig({});`,
        output: `createConfig({wrongMethodBehavior: 404,});`,
        errors: [
          {
            messageId: "add",
            data: {
              subject: "wrongMethodBehavior property",
              to: "configuration",
            },
          },
        ],
      },
      {
        code: `endpoint.getDescription("long");`,
        output: `endpoint.description;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getDescription",
              to: "description property",
            },
          },
        ],
      },
      {
        code: `endpoint.getDescription("short");`,
        output: `endpoint.shortDescription;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getDescription",
              to: "shortDescription property",
            },
          },
        ],
      },
      {
        code: `endpoint.getSchema("input");`,
        output: `endpoint.inputSchema;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getSchema",
              to: "inputSchema property",
            },
          },
        ],
      },
      {
        code: `endpoint.getSchema("output");`,
        output: `endpoint.outputSchema;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getSchema",
              to: "outputSchema property",
            },
          },
        ],
      },
      {
        code: `middleware.getSchema();`,
        output: `middleware.schema;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getSchema",
              to: "schema property",
            },
          },
        ],
      },
      {
        code: `endpoint.getMethods();`,
        output: `endpoint.methods;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getMethods",
              to: "methods property",
            },
          },
        ],
      },
      {
        code: `endpoint.getTags();`,
        output: `endpoint.tags;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getTags",
              to: "tags property",
            },
          },
        ],
      },
      {
        code: `endpoint.getScopes();`,
        output: `endpoint.scopes;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getScopes",
              to: "scopes property",
            },
          },
        ],
      },
      {
        code: `endpoint.getSecurity();`,
        output: `endpoint.security;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getSecurity",
              to: "security property",
            },
          },
        ],
      },
      {
        code: `endpoint.getRequestType();`,
        output: `endpoint.requestType;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getRequestType",
              to: "requestType property",
            },
          },
        ],
      },
    ],
  });
});
