import { RuleTester } from "@typescript-eslint/rule-tester";
import migration from "../../src/migration";
import parser from "@typescript-eslint/parser";
import { version } from "../../package.json";

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
});

tester.run("v21", migration.rules.v21, {
  valid: [{ code: `createConfig({ http: {} });` }],
  invalid: [
    {
      code: `createConfig({ server: {} });`,
      output: `createConfig({ http: {} });`,
      errors: [
        {
          messageId: "change",
          data: { subject: "property", from: "server", to: "http" },
        },
      ],
    },
    {
      code: `createConfig({ http: { listen: 8090, upload: true } });`,
      output: `createConfig({ http: { listen: 8090,  }, upload: true });`,
      errors: [
        {
          messageId: "move",
          data: {
            subject: "upload",
            from: "http",
            to: "the top level of createConfig argument",
          },
        },
      ],
    },
  ],
});
