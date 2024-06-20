import { RuleTester } from "eslint";
import migration from "../../src/migration";
import { describe, test, expect } from "vitest";
import parser from "@typescript-eslint/parser";

const tester = new RuleTester({
  languageOptions: { parser },
});

describe("Migration", () => {
  test("should consist of one rule", () => {
    expect(migration).toMatchSnapshot();
  });

  test("should pass ESLint rule tester", () => {
    tester.run("v20", migration.plugins["ez-migration"].rules.v20, {
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
            { message: `Change import "createLogger" to "BuiltinLogger".` },
          ],
        },
        {
          code: `import { createResultHandler } from "express-zod-api"`,
          output: `import { ResultHandler } from "express-zod-api"`,
          errors: [
            {
              message: `Change import "createResultHandler" to "ResultHandler".`,
            },
          ],
        },
        {
          code: `import { createMiddleware } from "express-zod-api"`,
          output: `import { Middleware } from "express-zod-api"`,
          errors: [
            { message: `Change import "createMiddleware" to "Middleware".` },
          ],
        },
        {
          code: `createLogger({})`,
          output: `new BuiltinLogger({})`,
          errors: [
            { message: `Change "createLogger" to "new BuiltinLogger".` },
          ],
        },
        {
          code: `createResultHandler({})`,
          output: `new ResultHandler({})`,
          errors: [
            { message: `Change "createResultHandler" to "new ResultHandler".` },
          ],
        },
        {
          code: `new ResultHandler({ getPositiveResponse: {}, getNegativeResponse: {} })`,
          output: `new ResultHandler({ positive: {}, negative: {} })`,
          errors: [
            { message: `Change property "getPositiveResponse" to "positive".` },
            { message: `Change property "getNegativeResponse" to "negative".` },
          ],
        },
        {
          code: `new Middleware({ middleware: {} })`,
          output: `new Middleware({ handler: {} })`,
          errors: [{ message: `Change property "middleware" to "handler".` }],
        },
        {
          code: `testEndpoint({ fnMethod: {}, responseProps: {} })`,
          output: `testEndpoint({  responseOptions: {} })`,
          errors: [
            { message: `Remove property "fnMethod".` },
            {
              message: `Change property "responseProps" to "responseOptions".`,
            },
          ],
        },
        {
          code: `interface MockOverrides extends Mock {}`,
          output: ``,
          errors: [
            {
              message: `Remove augmentation of the "MockOverrides" interface — no longer needed.`,
            },
          ],
        },
      ],
    });
  });
});
