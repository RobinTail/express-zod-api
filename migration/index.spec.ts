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
    valid: [
      `createConfig({ hintAllowedMethods: false });`,
      `createConfig({ recognizeMethodDependentRoutes: true });`,
      `new Documentation({ hasSummary: false });`,
    ],
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
      {
        name: "methodLikeRouteBehavior=method",
        code: `createConfig({ methodLikeRouteBehavior: "method" });`,
        output: `createConfig({ recognizeMethodDependentRoutes: true });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "methodLikeRouteBehavior",
              to: "recognizeMethodDependentRoutes",
            },
          },
        ],
      },
      {
        name: "methodLikeRouteBehavior=path",
        code: `createConfig({ methodLikeRouteBehavior: "path" });`,
        output: `createConfig({ recognizeMethodDependentRoutes: false });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "methodLikeRouteBehavior",
              to: "recognizeMethodDependentRoutes",
            },
          },
        ],
      },
      {
        name: "methodLikeRouteBehavior=undefined",
        code: `createConfig({ methodLikeRouteBehavior: undefined });`,
        output: `createConfig({ recognizeMethodDependentRoutes: undefined });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "methodLikeRouteBehavior",
              to: "recognizeMethodDependentRoutes",
            },
          },
        ],
      },
      {
        name: "hasSummaryFromDescription=true",
        code: `new Documentation({ hasSummaryFromDescription: true });`,
        output: `new Documentation({ hasSummary: true });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "hasSummaryFromDescription",
              to: "hasSummary",
            },
          },
        ],
      },
      {
        name: "hasSummaryFromDescription=false",
        code: `new Documentation({ hasSummaryFromDescription: false });`,
        output: `new Documentation({ hasSummary: false });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "hasSummaryFromDescription",
              to: "hasSummary",
            },
          },
        ],
      },
      {
        name: "hasSummaryFromDescription=undefined",
        code: `new Documentation({ hasSummaryFromDescription: undefined });`,
        output: `new Documentation({ hasSummary: undefined });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "hasSummaryFromDescription",
              to: "hasSummary",
            },
          },
        ],
      },
    ],
  });
});
