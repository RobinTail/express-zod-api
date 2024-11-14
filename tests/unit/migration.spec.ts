import { RuleTester } from "@typescript-eslint/rule-tester";
import migration from "../../src/migration";
import parser from "@typescript-eslint/parser";
import { version } from "../../package.json";

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

  tester.run("v21", migration.rules.v21, {
    valid: [
      `(() => {})()`,
      `createConfig({ http: {} });`,
      `createConfig({ http: { listen: 8090 }, upload: true });`,
      `createConfig({ beforeRouting: ({ getLogger }) => {} });`,
      `const { app, servers, logger } = await createServer();`,
      `console.error(error.cause?.message);`,
      `import { ensureHttpError } from "express-zod-api";`,
      `ensureHttpError(error).statusCode;`,
    ],
    invalid: [
      {
        code: `createConfig({ server: {} });`,
        output: `createConfig({ http: {} });`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "server", to: "http" },
          },
        ],
      },
      {
        code: `createConfig({ http: { listen: 8090, upload: true } });`,
        output: `createConfig({ http: { listen: 8090,  }, upload: true });`,
        errors: [
          {
            messageId: "move",
            data: {
              subject: "upload",
              from: "http",
              to: "the top level of createConfig argument",
            },
          },
        ],
      },
      {
        code: `createConfig({ beforeRouting: ({ logger }) => {} });`,
        output: `createConfig({ beforeRouting: ({ getLogger }) => {} });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "logger",
              to: "getLogger",
            },
          },
        ],
      },
      {
        code: `createConfig({ beforeRouting: ({ getChildLogger }) => {} });`,
        output: `createConfig({ beforeRouting: ({ getLogger }) => {} });`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "property",
              from: "getChildLogger",
              to: "getLogger",
            },
          },
        ],
      },
      {
        code: `const { app, httpServer, httpsServer, logger } = await createServer();`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "httpServer", to: "servers" },
          },
          {
            messageId: "change",
            data: { subject: "property", from: "httpsServer", to: "servers" },
          },
        ],
      },
      {
        code: `console.error(error.originalError?.message);`,
        errors: [
          {
            messageId: "change",
            data: { subject: "property", from: "originalError", to: "cause" },
          },
        ],
      },
      {
        code: `import { getStatusCodeFromError } from "express-zod-api";`,
        output: `import { ensureHttpError } from "express-zod-api";`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "import",
              from: "getStatusCodeFromError",
              to: "ensureHttpError",
            },
          },
        ],
      },
      {
        code: `getStatusCodeFromError(error);`,
        output: `ensureHttpError(error).statusCode;`,
        errors: [
          {
            messageId: "change",
            data: {
              subject: "method",
              from: "getStatusCodeFromError",
              to: "ensureHttpError().statusCode",
            },
          },
        ],
      },
    ],
  });
});
