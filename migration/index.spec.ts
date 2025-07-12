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

  tester.run("v24", migration.rules.v25, {
    valid: [`import {} from "zod";`],
    invalid: [
      {
        code: `import {} from "zod/v4";`,
        output: `import {} from "zod";`,
        errors: [
          {
            messageId: "change",
            data: { subject: "import", from: "zod/v4", to: "zod" },
          },
        ],
      },
    ],
  });
});
