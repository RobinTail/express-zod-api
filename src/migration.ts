import type { TSESLint } from "@typescript-eslint/utils";
import { mapObjIndexed } from "ramda";

const pluginName = "ez-migration";

const changes = {
  createLogger: "BuiltinLogger",
  createResultHandler: "ResultHandler",
  createMiddleware: "Middleware",
};

const messages = mapObjIndexed(
  (value, key) => `Change ${key} to ${value}.`,
  changes,
);

const shouldReplace = (subject: string): subject is keyof typeof changes =>
  subject in changes;

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
                shouldReplace(spec.imported.name)
              ) {
                const replacement = changes[spec.imported.name];
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
            shouldReplace(node.callee.name)
          ) {
            const replacement = `new ${changes[node.callee.name]}`;
            context.report({
              node,
              messageId: node.callee.name,
              fix: (fixer) => fixer.replaceText(node.callee, replacement),
            });
          }
        },
      };
    },
  } satisfies TSESLint.RuleModule<keyof typeof changes>,
};

export const migration = {
  rules: {
    [`${pluginName}/changed-imports`]: "error",
  } satisfies Record<`${typeof pluginName}/${keyof typeof rules}`, "error">,
  plugins: { [pluginName]: { rules } },
};
