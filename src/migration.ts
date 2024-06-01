import type { TSESLint } from "@typescript-eslint/utils";
import { mapObjIndexed } from "ramda";

const pluginName = "ez-migration";

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

const removedProps = {
  fnMethod: null,
};

const messages = mapObjIndexed(
  (value, key) => (value ? `Change ${key} to ${value}.` : `Remove ${key}`),
  {
    ...changedMethods,
    ...changedProps,
    ...removedProps,
  },
);

const shouldReplace = <T extends Record<string, unknown>>(
  subject: unknown,
  scope: T,
): subject is keyof T => typeof subject === "string" && subject in scope;

const rules = {
  v20: {
    defaultOptions: [],
    meta: {
      type: "suggestion",
      fixable: "code",
      messages,
      schema: [],
    },
    create(context) {
      return {
        ImportDeclaration(node) {
          if (node.source.value === "express-zod-api") {
            for (const spec of node.specifiers) {
              if (
                spec.type === "ImportSpecifier" &&
                shouldReplace(spec.imported.name, changedMethods)
              ) {
                const replacement = changedMethods[spec.imported.name];
                context.report({
                  node,
                  messageId: spec.imported.name,
                  fix: (fixer) => fixer.replaceText(spec, replacement),
                });
              }
            }
          }
        },
        CallExpression(node) {
          if (
            node.callee.type === "Identifier" &&
            shouldReplace(node.callee.name, changedMethods)
          ) {
            const replacement = `new ${changedMethods[node.callee.name]}`;
            context.report({
              node,
              messageId: node.callee.name,
              fix: (fixer) => fixer.replaceText(node.callee, replacement),
            });
          }
          if (
            node.callee.type === "Identifier" &&
            node.callee.name === "testEndpoint" &&
            node.arguments.length === 1 &&
            node.arguments[0].type === "ObjectExpression"
          ) {
            for (const prop of node.arguments[0].properties) {
              if (prop.type === "Property" && prop.key.type === "Identifier") {
                if (shouldReplace(prop.key.name, changedProps)) {
                  const replacement = changedProps[prop.key.name];
                  context.report({
                    node: prop,
                    messageId: prop.key.name,
                    fix: (fixer) => fixer.replaceText(prop.key, replacement),
                  });
                }
                if (shouldReplace(prop.key.name, removedProps)) {
                  context.report({
                    node: prop,
                    messageId: prop.key.name,
                    fix: (fixer) => {
                      const next = context.sourceCode.getTokenAfter(prop);
                      return next?.value === ","
                        ? fixer.removeRange([prop.range[0], next.range[1] + 1])
                        : fixer.remove(prop);
                    },
                  });
                }
              }
            }
          }
        },
        NewExpression(node) {
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
                  messageId: prop.key.name,
                  fix: (fixer) => fixer.replaceText(prop.key, replacement),
                });
              }
            }
          }
        },
      };
    },
  } satisfies TSESLint.RuleModule<keyof typeof messages>,
};

/** @desc ESLint plugin for migrating to this version */
export const migration = {
  rules: {
    [`${pluginName}/v20`]: "error",
  } satisfies Record<`${typeof pluginName}/${keyof typeof rules}`, "error">,
  plugins: { [pluginName]: { rules } },
} as object; // reducing DTS
