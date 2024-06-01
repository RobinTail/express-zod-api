import type { Rule } from "eslint";
import { fromPairs, keys, xprod } from "ramda";

const pluginName = "ez-migration";
const importName = "express-zod-api";
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
};

const removedProps = { fnMethod: null };

const shouldReplace = <T extends Record<string, unknown>>(
  subject: unknown,
  scope: T,
): subject is keyof T => typeof subject === "string" && subject in scope;

const v20: Rule.RuleModule = {
  meta: { type: "problem", fixable: "code" },
  create: (context) => ({
    ImportDeclaration: (node) => {
      if (node.source.value === importName) {
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            shouldReplace(spec.imported.name, changedMethods)
          ) {
            const replacement = changedMethods[spec.imported.name];
            context.report({
              node: spec.imported,
              message: `Change import "${spec.imported.name}" to "${replacement}".`,
              fix: (fixer) => fixer.replaceText(spec, replacement),
            });
          }
        }
      }
    },
    CallExpression: (node) => {
      if (
        node.callee.type === "Identifier" &&
        shouldReplace(node.callee.name, changedMethods)
      ) {
        const replacement = `new ${changedMethods[node.callee.name]}`;
        context.report({
          node: node.callee,
          message: `Change "${node.callee.name}" to "${replacement}".`,
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
            if (shouldReplace(prop.key.name, changedProps)) {
              const replacement = changedProps[prop.key.name];
              context.report({
                node: prop,
                message: `Change property "${prop.key.name}" to "${replacement}".`,
                fix: (fixer) => fixer.replaceText(prop.key, replacement),
              });
            }
            if (shouldReplace(prop.key.name, removedProps)) {
              context.report({
                node: prop,
                message: `Remove property "${prop.key.name}".`,
                fix: (fixer) =>
                  context.sourceCode.getTokenAfter(prop)?.value === "," &&
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
        node.callee.name === changedMethods.createResultHandler &&
        node.arguments.length === 1 &&
        node.arguments[0].type === "ObjectExpression"
      ) {
        for (const prop of node.arguments[0].properties) {
          if (
            prop.type === "Property" &&
            prop.key.type === "Identifier" &&
            shouldReplace(prop.key.name, changedProps)
          ) {
            const replacement = changedProps[prop.key.name];
            context.report({
              node: prop,
              message: `Change property "${prop.key.name}" to "${replacement}".`,
              fix: (fixer) => fixer.replaceText(prop.key, replacement),
            });
          }
        }
      }
    },
  }),
};

const rules = { v20 };

/** @desc ESLint plugin for migrating to this version */
export const migration = {
  rules: fromPairs(
    xprod(
      keys(rules).map((rule) => `${pluginName}/${rule}` as const),
      ["error" as const],
    ),
  ),
  plugins: { [pluginName]: { rules } },
};
