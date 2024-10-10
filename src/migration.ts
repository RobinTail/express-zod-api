import { ESLintUtils, type TSESLint } from "@typescript-eslint/utils";
import { name as importName } from "../package.json";

const testerName = "testEndpoint";

const changedMethods = {
  createLogger: "BuiltinLogger",
  createResultHandler: "ResultHandler",
  createMiddleware: "Middleware",
};

const changedProps = {
  getPositiveResponse: "positive",
  getNegativeResponse: "negative",
  responseProps: "responseOptions",
  middleware: "handler",
};

const removedProps = { fnMethod: null };

const shouldAct = <T extends Record<string, unknown>>(
  subject: unknown,
  scope: T,
): subject is keyof T => typeof subject === "string" && subject in scope;

const v21 = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {
      change: "Change {{subject}} {{from}} to {{to}}.",
      remove: "Remove {{subject}} {{name}}.",
    },
  },
  defaultOptions: [],
  create: (ctx) => ({
    ImportDeclaration: (node) => {
      if (node.source.value === importName) {
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            shouldAct(spec.imported.name, changedMethods)
          ) {
            const replacement = changedMethods[spec.imported.name];
            ctx.report({
              node: spec.imported,
              messageId: "change",
              data: {
                subject: "import",
                from: spec.imported.name,
                to: replacement,
              },
              fix: (fixer) => fixer.replaceText(spec, replacement),
            });
          }
        }
      }
    },
    CallExpression: (node) => {
      if (
        node.callee.type === "Identifier" &&
        shouldAct(node.callee.name, changedMethods)
      ) {
        const replacement = `new ${changedMethods[node.callee.name]}`;
        ctx.report({
          node: node.callee,
          messageId: "change",
          data: { subject: "call", from: node.callee.name, to: replacement },
          fix: (fixer) => fixer.replaceText(node.callee, replacement),
        });
      }
      if (
        node.callee.type === "Identifier" &&
        node.callee.name === testerName &&
        node.arguments.length === 1 &&
        node.arguments[0].type === "ObjectExpression"
      ) {
        for (const prop of node.arguments[0].properties) {
          if (prop.type === "Property" && prop.key.type === "Identifier") {
            if (shouldAct(prop.key.name, changedProps)) {
              const replacement = changedProps[prop.key.name];
              ctx.report({
                node: prop,
                messageId: "change",
                data: {
                  subject: "property",
                  from: prop.key.name,
                  to: replacement,
                },
                fix: (fixer) => fixer.replaceText(prop.key, replacement),
              });
            }
            if (shouldAct(prop.key.name, removedProps)) {
              ctx.report({
                node: prop,
                messageId: "remove",
                data: { subject: "property", name: prop.key.name },
                fix: (fixer) =>
                  ctx.sourceCode.getTokenAfter(prop)?.value === "," &&
                  prop.range
                    ? fixer.removeRange([prop.range[0], prop.range[1] + 1])
                    : fixer.remove(prop),
              });
            }
          }
        }
      }
    },
    NewExpression: (node) => {
      if (
        node.callee.type === "Identifier" &&
        [
          changedMethods.createResultHandler,
          changedMethods.createMiddleware,
        ].includes(node.callee.name) &&
        node.arguments.length === 1 &&
        node.arguments[0].type === "ObjectExpression"
      ) {
        for (const prop of node.arguments[0].properties) {
          if (
            prop.type === "Property" &&
            prop.key.type === "Identifier" &&
            shouldAct(prop.key.name, changedProps)
          ) {
            const replacement = changedProps[prop.key.name];
            ctx.report({
              node: prop,
              messageId: "change",
              data: {
                subject: "property",
                from: prop.key.name,
                to: replacement,
              },
              fix: (fixer) => fixer.replaceText(prop.key, replacement),
            });
          }
        }
      }
    },
    Identifier: (node) => {
      if (
        node.name === "MockOverrides" &&
        node.parent.type === "TSInterfaceDeclaration"
      ) {
        ctx.report({
          node,
          messageId: "remove",
          data: { subject: "augmentation", name: node.name },
          fix: (fixer) => fixer.remove(node.parent),
        });
      }
    },
  }),
});

/**
 * @desc ESLint plugin for migrating to this version (from previous), requires eslint v9 and typescript-eslint v8
 * @deprecated Single-use tool that can be removed and changed regardless SemVer. Remember to delete it after use.
 * @example
 *          // eslint.config.mjs:
 *          import parser from "@typescript-eslint/parser";
 *          import migration from "express-zod-api/migration";
 *          export default [
 *            { languageOptions: {parser}, plugins: {migration} },
 *            { files: ["**\/*.ts"], rules: { "migration/v21": "error" } }
 *          ];
 * */
export default {
  rules: { v21 },
} satisfies TSESLint.Linter.Plugin;
