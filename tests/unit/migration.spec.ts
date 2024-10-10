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
  valid: [{ code: `import {} from "express-zod-api"` }],
  invalid: [],
});
