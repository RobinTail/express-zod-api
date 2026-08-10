import { RuleTester } from "oxlint/plugins-dev";
import manifest from "./package.json";
import assert from "node:assert/strict";

RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { parserOptions: { lang: "ts" } },
});

describe("Migration", async () => {
  const { default: migration } = await import("./index");
  const ruleName = `v${manifest.version.split(".")[0]}`;
  const theRule = migration.rules[ruleName as keyof typeof migration.rules];
  assert(theRule, "Rule not found");

  test("should consist of one rule being the major version of the package", () => {
    expect(migration.rules).toHaveProperty(ruleName);
    expect(migration).toMatchSnapshot();
  });

  tester.run(ruleName, theRule, {
    valid: [
      `import { EndpointsFactory } from "express-zod-api";`,
      `import { ResultHandler } from "express-zod-api";`,
    ],
    invalid: [
      {
        name: "defaultResultHandler import",
        code: `import { defaultResultHandler } from "express-zod-api";`,
        output:
          `import { z } from "zod";\n` +
          `import { ResultHandler, ensureHttpError } from "express-zod-api";\n` +
          `export const legacyResultHandler = new ResultHandler({\n` +
          `  positive: (output) => z.object({ status: z.literal("success"), data: output }),\n` +
          `  negative: z.object({\n` +
          `    status: z.literal("error"),\n` +
          `    error: z.object({ message: z.string() }),\n` +
          `  }),\n` +
          `  handler: ({ error, input, output, request, response, logger }) => {\n` +
          `    if (error) {\n` +
          `      const httpError = ensureHttpError(error);\n` +
          `      return void response\n` +
          `        .status(httpError.statusCode)\n` +
          `        .set(httpError.headers)\n` +
          `        .json({\n` +
          `          status: "error",\n` +
          `          // @todo ensure it's appropriate to expose the error message
          error: { message: httpError.message },\n` +
          `        });\n` +
          `    }\n` +
          `    response.status(200)\n` +
          `      .json({ status: "success", data: output });\n` +
          `  },\n` +
          `});`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "import",
              from: "defaultResultHandler",
              to: "legacyResultHandler",
            },
          },
        ],
      },
      {
        name: "defaultEndpointsFactory import",
        code: `import { defaultEndpointsFactory } from "express-zod-api";`,
        output:
          `import { z } from "zod";\n` +
          `import { ResultHandler, ensureHttpError, EndpointsFactory } from "express-zod-api";\n` +
          `export const legacyResultHandler = new ResultHandler({\n` +
          `  positive: (output) => z.object({ status: z.literal("success"), data: output }),\n` +
          `  negative: z.object({\n` +
          `    status: z.literal("error"),\n` +
          `    error: z.object({ message: z.string() }),\n` +
          `  }),\n` +
          `  handler: ({ error, input, output, request, response, logger }) => {\n` +
          `    if (error) {\n` +
          `      const httpError = ensureHttpError(error);\n` +
          `      return void response\n` +
          `        .status(httpError.statusCode)\n` +
          `        .set(httpError.headers)\n` +
          `        .json({\n` +
          `          status: "error",\n` +
          `          // @todo ensure it's appropriate to expose the error message
          error: { message: httpError.message },\n` +
          `        });\n` +
          `    }\n` +
          `    response.status(200)\n` +
          `      .json({ status: "success", data: output });\n` +
          `  },\n` +
          `});\n` +
          `export const legacyEndpointsFactory = new EndpointsFactory(legacyResultHandler);`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "import",
              from: "defaultEndpointsFactory",
              to: "legacyEndpointsFactory",
            },
          },
        ],
      },
    ],
  });
});
