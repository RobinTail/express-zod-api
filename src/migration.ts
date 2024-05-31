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

const messages = mapObjIndexed((value, key) => `Change ${key} to ${value}.`, {
  ...changedMethods,
  ...changedProps,
});

const shouldReplace = <T extends Record<string, string>>(
  subject: unknown,
  scope: T,
): subject is keyof T => typeof subject === "string" && subject in scope;

const rules = {
  "changed-imports": {
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

export const migration = {
  rules: {
    [`${pluginName}/changed-imports`]: "error",
  } satisfies Record<`${typeof pluginName}/${keyof typeof rules}`, "error">,
  plugins: { [pluginName]: { rules } },
};
