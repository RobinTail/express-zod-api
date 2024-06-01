import { RuleTester } from "eslint";
import { migration } from "../../src";
import { describe, test } from "vitest";

const tester = new RuleTester();

describe("Migration", () => {
  test("should pass ESLint rule tester", () => {
    tester.run("v20", migration.plugins["ez-migration"].rules.v20, {
      valid: [
        { code: `import { BuiltinLogger } from "express-zod-api"` },
        { code: `import { ResultHandler } from "express-zod-api"` },
        { code: `import { Middleware } from "express-zod-api"` },
        { code: `new BuiltinLogger({})` },
        { code: `new ResultHandler({ positive: {}, negative: {} })` },
        { code: `new Middleware({})` },
        { code: `testEndpoint({})` },
      ],
      invalid: [
        {
          code: `import { createLogger } from "express-zod-api"`,
          errors: [
            { message: `Change import "createLogger" to "BuiltinLogger".` },
          ],
          output: `import { BuiltinLogger } from "express-zod-api"`,
        },
        {
          code: `import { createResultHandler } from "express-zod-api"`,
          errors: [
            {
              message: `Change import "createResultHandler" to "ResultHandler".`,
            },
          ],
          output: `import { ResultHandler } from "express-zod-api"`,
        },
        {
          code: `import { createMiddleware } from "express-zod-api"`,
          errors: [
            { message: `Change import "createMiddleware" to "Middleware".` },
          ],
          output: `import { Middleware } from "express-zod-api"`,
        },
        {
          code: `createLogger({})`,
          errors: [
            { message: `Change "createLogger" to "new BuiltinLogger".` },
          ],
          output: `new BuiltinLogger({})`,
        },
        {
          code: `createResultHandler({})`,
          errors: [
            { message: `Change "createResultHandler" to "new ResultHandler".` },
          ],
          output: `new ResultHandler({})`,
        },
        {
          code: `new ResultHandler({ getPositiveResponse: {}, getNegativeResponse: {} })`,
          errors: [
            { message: `Change property "getPositiveResponse" to "positive".` },
            { message: `Change property "getNegativeResponse" to "negative".` },
          ],
          output: `new ResultHandler({ positive: {}, negative: {} })`,
        },
        {
          code: `testEndpoint({ fnMethod: {}, responseProps: {} })`,
          errors: [
            { message: `Remove property "fnMethod".` },
            {
              message: `Change property "responseProps" to "responseOptions".`,
            },
          ],
          output: `testEndpoint({  responseOptions: {} })`,
        },
      ],
    });
  });
});
