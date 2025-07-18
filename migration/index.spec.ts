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

  tester.run("v24", migration.rules.v24, {
    valid: [
      `new Documentation({});`,
      `new Integration({});`,
      `const rule: Depicter = () => {};`,
      `import {} from "zod/v4";`,
      `ez.buffer();`,
    ],
    invalid: [
      {
        code: `new Documentation({ numericRange: {}, });`,
        output: `new Documentation({  });`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "numericRange" },
          },
        ],
      },
      {
        code: `new Integration({ optionalPropStyle: {}, });`,
        output: `new Integration({  });`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "optionalPropStyle" },
          },
        ],
      },
      {
        code:
          `const rule: Depicter = (schema, { next, path, method, isResponse }) ` +
          `=> ({ ...next(schema.unwrap()), summary: "test" })`,
        output:
          `const rule: Depicter = ({ zodSchema: schema, jsonSchema }, {  path, method, isResponse }) ` +
          `=> ({ ...jsonSchema, summary: "test" })`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "arguments",
              from: "[schema, { next, ...rest }]",
              to: "[{ zodSchema: schema, jsonSchema }, { ...rest }]",
            },
          },
          {
            messageId: "change",
            data: { subject: "statement", from: "next()", to: "jsonSchema" },
          },
        ],
      },
      {
        code: `import {} from "zod";`,
        output: `import {} from "zod/v4";`,
        errors: [
          {
            messageId: "change",
            data: { subject: "import", from: "zod", to: "zod/v4" },
          },
        ],
      },
      {
        code: `ez.file("string");`,
        output: `z.string();`,
        errors: [
          {
            messageId: "change",
            data: { subject: "schema", from: "ez.file()", to: "z.string()" },
          },
        ],
      },
      {
        code: `ez.file("buffer");`,
        output: `ez.buffer();`,
        errors: [
          {
            messageId: "change",
            data: { subject: "schema", from: "ez.file()", to: "ez.buffer()" },
          },
        ],
      },
      {
        code: `ez.file("base64");`,
        output: `z.base64();`,
        errors: [
          {
            messageId: "change",
            data: { subject: "schema", from: "ez.file()", to: "z.base64()" },
          },
        ],
      },
      {
        code: `ez.file("binary");`,
        output: `ez.buffer().or(z.string());`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "schema",
              from: "ez.file()",
              to: "ez.buffer().or(z.string())",
            },
          },
        ],
      },
    ],
  });
});
