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
      ],
    });
  });
});
