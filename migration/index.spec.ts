import { RuleTester } from "@typescript-eslint/rule-tester";
import migration from "./index";
import parser from "@typescript-eslint/parser";
import { version } from "./package.json";

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

  tester.run("v26", migration.rules.v26, {
    valid: [`const routing = { "get /": someEndpoint };`],
    invalid: [
      {
        code: `const routing = new DependsOnMethod({ get: someEndpoint });`,
        output: `const routing = {\n"get /": someEndpoint,\n};`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "value",
              from: "new DependsOnMethod(...)",
              to: "its argument object and append its keys with ' /'",
            },
          },
        ],
      },
    ],
  });
});
