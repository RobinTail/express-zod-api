import { RuleTester } from "@typescript-eslint/rule-tester";
import migration from "../../express-zod-api/src/migration";
import parser from "@typescript-eslint/parser";
import { version } from "../../express-zod-api/package.json";

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

  tester.run("v22", migration.rules.v22, {
    valid: [
      `client.provide("get /v1/test", {id: 10});`,
      `new Integration({ routing });`,
      `import { Request } from "./client.ts";`,
      `createConfig({ cors: true });`,
      `new Documentation();`,
      `new EndpointsFactory(new ResultHandler());`,
      `new EventStreamFactory({});`,
      `new Client();`,
    ],
    invalid: [
      {
        code: `client.provide("get", "/v1/test", {id: 10});`,
        output: `client.provide("get /v1/test", {id: 10});`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "arguments",
              from: `"get", "/v1/test"`,
              to: `"get /v1/test"`,
            },
          },
        ],
      },
      {
        code: `new Integration({ routing, splitResponse: true });`,
        output: `new Integration({ routing,  });`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "property", name: "splitResponse" },
          },
        ],
      },
      {
        code: `import { MethodPath } from "./client.ts";`,
        output: `import { Request } from "./client.ts";`,
        errors: [
          {
            messageId: "change",
            data: { subject: "type", from: "MethodPath", to: "Request" },
          },
        ],
      },
      {
        code: `createConfig({ tags: { users: "" } });`,
        output:
          `createConfig({  });\n` +
          `// Declaring tag constraints\n` +
          `declare module "express-zod-api" {\n` +
          `  interface TagOverrides {\n` +
          `    "users": unknown,\n` +
          `  }\n` +
          `}`,
        errors: [
          { messageId: "remove", data: { subject: "property", name: "tags" } },
        ],
      },
      {
        code: `new Documentation({ config });`,
        output: `new Documentation({ tags: { /* move from createConfig() argument if any */ }, config });`,
        errors: [
          { messageId: "add", data: { subject: "tags", to: "Documentation" } },
        ],
      },
      {
        code: `new EndpointsFactory({config, resultHandler: new ResultHandler() });`,
        output: `new EndpointsFactory(new ResultHandler());`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "argument",
              from: "object",
              to: "ResultHandler instance",
            },
          },
        ],
      },
      {
        code: `new EventStreamFactory({ config, events: { some } });`,
        output: `new EventStreamFactory({ some });`,
        errors: [
          {
            messageId: "change",
            data: { subject: "argument", from: "object", to: "events map" },
          },
        ],
      },
      {
        code: `new ExpressZodAPIClient();`,
        output: `new Client();`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "class",
              from: "ExpressZodAPIClient",
              to: "Client",
            },
          },
        ],
      },
    ],
  });
});
