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
    valid: [`createConfig({ hintAllowedMethods: false });`],
    invalid: [
      {
        name: "wrongMethodBehavior=404",
        code: `createConfig({ wrongMethodBehavior: 404 });`,
        output: `createConfig({ hintAllowedMethods: false });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "wrongMethodBehavior",
              to: "hintAllowedMethods",
            },
          },
        ],
      },
      {
        name: "wrongMethodBehavior=405",
        code: `createConfig({ wrongMethodBehavior: 405 });`,
        output: `createConfig({ hintAllowedMethods: true });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "wrongMethodBehavior",
              to: "hintAllowedMethods",
            },
          },
        ],
      },
      {
        name: "wrongMethodBehavior=undefined",
        code: `createConfig({ wrongMethodBehavior: undefined });`,
        output: `createConfig({ hintAllowedMethods: undefined });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "wrongMethodBehavior",
              to: "hintAllowedMethods",
            },
          },
        ],
      },
    ],
  });
});
