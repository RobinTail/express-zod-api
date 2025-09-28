import { RuleTester } from "@typescript-eslint/rule-tester";
import migration from "./index.ts";
import parser from "@typescript-eslint/parser";
import manifest from "./package.json" with { type: "json" };

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parser },
});

describe("Migration", () => {
  test("should consist of one rule being the major version of the package", () => {
    expect(migration.rules).toHaveProperty(
      `v${manifest.version.split(".")[0]}`,
    );
    expect(migration).toMatchSnapshot();
  });

  tester.run("v25", migration.rules.v25, {
    valid: [
      `import {} from "zod";`,
      `ez.dateIn({ examples: ["1963-04-21"] });`,
      `ez.dateOut({ examples: ["2021-12-31T00:00:00.000Z"] });`,
      `schema.meta()?.examples;`,
    ],
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
      {
        code: `ez.dateIn({ example: "1963-04-21" });`,
        output: `ez.dateIn({ examples: ["1963-04-21"] });`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "example", to: "examples" },
          },
        ],
      },
      {
        code: `ez.dateOut({ example: "2021-12-31T00:00:00.000Z" });`,
        output: `ez.dateOut({ examples: ["2021-12-31T00:00:00.000Z"] });`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "example", to: "examples" },
          },
        ],
      },
      {
        code: `getExamples(schema);`,
        output: `(schema.meta()?.examples || []);`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getExamples()",
              to: ".meta()?.examples || []",
            },
          },
        ],
      },
    ],
  });
});
