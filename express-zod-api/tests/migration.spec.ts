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
    ],
  });
});
