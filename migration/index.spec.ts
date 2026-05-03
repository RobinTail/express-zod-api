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
  const { default: migration } = await import("./index");
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
      `new Documentation({ summarizer: ({summary, trim}) => trim(summary) });`,
      `new Integration({ noBodySchema: z.undefined() });`,
      `factory.build({ summary: "hello" });`,
      `factory.buildVoid({ summary: "hello" });`,
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
        name: "wrongMethodBehavior is wrong",
        code: `createConfig({ wrongMethodBehavior: "wrong" });`,
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
        name: "methodLikeRouteBehavior is wrong",
        code: `createConfig({ methodLikeRouteBehavior: 123 });`,
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
        name: "hasSummaryFromDescription=true (first)",
        code: `new Documentation({ hasSummaryFromDescription: true, other: 1 });`,
        output: `new Documentation({  other: 1 });`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "property" },
          },
        ],
      },
      {
        name: "hasSummaryFromDescription=undefined (last)",
        code: `new Documentation({ other: 1, hasSummaryFromDescription: undefined });`,
        output: `new Documentation({ other: 1,  });`,
        errors: [
          {
            messageId: "remove",
            data: { subject: "property" },
          },
        ],
      },
      {
        name: "hasSummaryFromDescription=false",
        code: `new Documentation({ hasSummaryFromDescription: false });`,
        output: `new Documentation({ summarizer: ({ summary, trim }) => trim(summary) });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "hasSummaryFromDescription",
              to: "summarizer",
            },
          },
        ],
      },
      {
        name: "noContent=z.undefined()",
        code: `new Integration({ noContent: z.undefined() });`,
        output: `new Integration({ noBodySchema: z.undefined() });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "noContent",
              to: "noBodySchema",
            },
          },
        ],
      },
      {
        name: "noContent=undefined",
        code: `new Integration({ noContent: undefined });`,
        output: `new Integration({ noBodySchema: undefined });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "noContent",
              to: "noBodySchema",
            },
          },
        ],
      },
      {
        name: "shortDescription in build()",
        code: `factory.build({ shortDescription: "Retrieves the user." });`,
        output: `factory.build({ summary: "Retrieves the user." });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "shortDescription",
              to: "summary",
            },
          },
        ],
      },
      {
        name: "shortDescription in buildVoid()",
        code: `factory.buildVoid({ shortDescription: "Retrieves the user." });`,
        output: `factory.buildVoid({ summary: "Retrieves the user." });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "shortDescription",
              to: "summary",
            },
          },
        ],
      },
      {
        name: "wrongMethodBehavior with string key",
        code: `createConfig({ "wrongMethodBehavior": 405 });`,
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
        name: "noContent with string key",
        code: `new Integration({ "noContent": z.undefined() });`,
        output: `new Integration({ noBodySchema: z.undefined() });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "noContent",
              to: "noBodySchema",
            },
          },
        ],
      },
      {
        name: "hasSummaryFromDescription=false with string key",
        code: `new Documentation({ "hasSummaryFromDescription": false });`,
        output: `new Documentation({ summarizer: ({ summary, trim }) => trim(summary) });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "hasSummaryFromDescription",
              to: "summarizer",
            },
          },
        ],
      },
      {
        name: "shortDescription with string key in build()",
        code: `factory.build({ "shortDescription": "Retrieves the user." });`,
        output: `factory.build({ summary: "Retrieves the user." });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "shortDescription",
              to: "summary",
            },
          },
        ],
      },
    ],
  });
});
