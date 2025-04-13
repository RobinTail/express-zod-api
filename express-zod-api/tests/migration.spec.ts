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
      `testMiddleware({ middleware })`,
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
        code: `testMiddleware({ errorHandler: (error, response) => response.end(error.message) })`,
        output: `testMiddleware({configProps: {errorHandler: new ResultHandler({ positive: [], negative: [], handler: ({ error, response }) => {response.end(error.message)} }),},  })`,
        errors: [
          {
            messageId: "move",
            data: { subject: "errorHandler", to: "configProps" },
          },
        ],
      },
      {
        code: `testMiddleware({ errorHandler(error, response) { response.end(error.message) }, configProps: { wrongMethodBehavior: 404 } })`,
        output: `testMiddleware({  configProps: {errorHandler: new ResultHandler({ positive: [], negative: [], handler: ({ error, response }) => {{ response.end(error.message) }} }), wrongMethodBehavior: 404 } })`,
        errors: [
          {
            messageId: "move",
            data: { subject: "errorHandler", to: "configProps" },
          },
        ],
      },
    ],
  });
});
