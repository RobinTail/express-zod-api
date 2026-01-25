import { RuleTester } from "@typescript-eslint/rule-tester";
import { parser } from "typescript-eslint";
import manifest from "./package.json";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parser },
});

describe("Migration", async () => {
  vi.stubEnv("TSDOWN_VERSION", manifest.version);
  const { default: migration } = await import("./");
  const ruleName = `v${manifest.version.split(".")[0]}`;
  const theRule = migration.rules[ruleName as keyof typeof migration.rules];

  test("should consist of one rule being the major version of the package", () => {
    expect(migration.rules).toHaveProperty(ruleName);
    expect(migration).toMatchSnapshot();
  });

  tester.run(ruleName, theRule, {
    valid: [`new Integration({ typescript, config, routing });`],
    invalid: [
      {
        name: "should import typescript and add it as a property to constructor argument",
        code: `new Integration({ config, routing });`,
        output: `import typescript from "typescript";\n\nnew Integration({ typescript, config, routing });`,
        errors: [
          {
            messageId: "add",
            data: {
              subject: "typescript property",
              to: "constructor argument",
            },
          },
        ],
      },
      {
        name: "should handle no props",
        code: `new Integration({});`,
        output: `import typescript from "typescript";\n\nnew Integration({ typescript });`,
        errors: [
          {
            messageId: "add",
            data: {
              subject: "typescript property",
              to: "constructor argument",
            },
          },
        ],
      },
      {
        name: "should use static create() method when there is 'await' statement",
        code: `await new Integration({ config, routing }).printFormatted();`,
        output: `await (await Integration.create({ config, routing })).printFormatted();`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "constructor",
              from: "new Integration()",
              to: "await Integration.create()",
            },
          },
        ],
      },
      {
        name: "should use static create() method when inside async functional expression",
        code: `async () => { new Integration({ config, routing }); }`,
        output: `async () => { (await Integration.create({ config, routing })); }`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "constructor",
              from: "new Integration()",
              to: "await Integration.create()",
            },
          },
        ],
      },
      {
        name: "should use static create() method when inside async function declaration",
        code: `async function test() { new Integration({ config, routing }); }`,
        output: `async function test() { (await Integration.create({ config, routing })); }`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "constructor",
              from: "new Integration()",
              to: "await Integration.create()",
            },
          },
        ],
      },
    ],
  });
});
