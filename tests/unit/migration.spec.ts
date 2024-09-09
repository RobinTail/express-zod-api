import { RuleTester } from "@typescript-eslint/rule-tester";
import migration from "../../src/migration";
import parser from "@typescript-eslint/parser";

RuleTester.afterAll = afterAll;
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parser },
});

describe("Migration", () => {
  test("should consist of one rule", () => {
    expect(migration).toMatchSnapshot();
  });
});

tester.run("v20", migration.rules.v20, {
  valid: [
    { code: `import { BuiltinLogger } from "express-zod-api"` },
    { code: `import { ResultHandler } from "express-zod-api"` },
    { code: `import { Middleware } from "express-zod-api"` },
    { code: `new BuiltinLogger({})` },
    { code: `new ResultHandler({ positive: {}, negative: {} })` },
    { code: `new Middleware({ handler: {} })` },
    { code: `testEndpoint({})` },
  ],
  invalid: [
    {
      code: `import { createLogger } from "express-zod-api"`,
      output: `import { BuiltinLogger } from "express-zod-api"`,
      errors: [
        {
          messageId: "change",
          data: {
            subject: "import",
            from: "createLogger",
            to: "BuiltinLogger",
          },
        },
      ],
    },
    {
      code: `import { createResultHandler } from "express-zod-api"`,
      output: `import { ResultHandler } from "express-zod-api"`,
      errors: [
        {
          messageId: "change",
          data: {
            subject: "import",
            from: "createResultHandler",
            to: "ResultHandler",
          },
        },
      ],
    },
    {
      code: `import { createMiddleware } from "express-zod-api"`,
      output: `import { Middleware } from "express-zod-api"`,
      errors: [
        {
          messageId: "change",
          data: {
            subject: "import",
            from: "createMiddleware",
            to: "Middleware",
          },
        },
      ],
    },
    {
      code: `createLogger({})`,
      output: `new BuiltinLogger({})`,
      errors: [
        {
          messageId: "change",
          data: {
            subject: "call",
            from: "createLogger",
            to: "new BuiltinLogger",
          },
        },
      ],
    },
    {
      code: `createResultHandler({})`,
      output: `new ResultHandler({})`,
      errors: [
        {
          messageId: "change",
          data: {
            subject: "call",
            from: "createResultHandler",
            to: "new ResultHandler",
          },
        },
      ],
    },
    {
      code: `new ResultHandler({ getPositiveResponse: {}, getNegativeResponse: {} })`,
      output: `new ResultHandler({ positive: {}, negative: {} })`,
      errors: [
        {
          messageId: "change",
          data: {
            subject: "property",
            from: "getPositiveResponse",
            to: "positive",
          },
        },
        {
          messageId: "change",
          data: {
            subject: "property",
            from: "getNegativeResponse",
            to: "negative",
          },
        },
      ],
    },
    {
      code: `new Middleware({ middleware: {} })`,
      output: `new Middleware({ handler: {} })`,
      errors: [
        {
          messageId: "change",
          data: { subject: "property", from: "middleware", to: "handler" },
        },
      ],
    },
    {
      code: `testEndpoint({ fnMethod: {}, responseProps: {} })`,
      output: `testEndpoint({  responseOptions: {} })`,
      errors: [
        {
          messageId: "remove",
          data: { subject: "property", name: "fnMethod" },
        },
        {
          messageId: "change",
          data: {
            subject: "property",
            from: "responseProps",
            to: "responseOptions",
          },
        },
      ],
    },
    {
      code: `interface MockOverrides extends Mock {}`,
      output: ``,
      errors: [
        {
          messageId: "remove",
          data: { subject: "augmentation", name: "MockOverrides" },
        },
      ],
    },
  ],
});
