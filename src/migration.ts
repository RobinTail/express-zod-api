import type { Rule, Linter } from "eslint";

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
  middleware: "handler",
};

const removedProps = { fnMethod: null };

const shouldAct = <T extends Record<string, unknown>>(
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
            shouldAct(spec.imported.name, changedMethods)
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
        shouldAct(node.callee.name, changedMethods)
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
            if (shouldAct(prop.key.name, changedProps)) {
              const replacement = changedProps[prop.key.name];
              context.report({
                node: prop,
                message: `Change property "${prop.key.name}" to "${replacement}".`,
                fix: (fixer) => fixer.replaceText(prop.key, replacement),
              });
            }
            if (shouldAct(prop.key.name, removedProps)) {
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
            context.report({
              node: prop,
              message: `Change property "${prop.key.name}" to "${replacement}".`,
              fix: (fixer) => fixer.replaceText(prop.key, replacement),
            });
          }
        }
      }
    },
    Identifier: (node) => {
      if (
        node.name === "MockOverrides" &&
        `${node.parent.type}` === "TSInterfaceDeclaration"
      ) {
        context.report({
          node,
          message: `Remove augmentation of the "${node.name}" interface — no longer needed.`,
          fix: (fixer) => fixer.remove(node.parent),
        });
      }
    },
  }),
};

const rules = { v20 };

/**
 * @desc ESLint flat config entry for migrating to this version (from previous), requires at least ESLint 8 or higher
 * @deprecated Single-use tool that can be removed and changed regardless SemVer. Remember to delete it after use.
 * @example
 *          // eslint.config.mjs:
 *          import parser from "@typescript-eslint/parser";
 *          import migration from "express-zod-api/migration";
 *          export default [{ languageOptions: { parser }, files: ["**\/*.ts"] }, migration];
 * */
export default {
  rules: { "ez-migration/v20": "error" },
  plugins: { [pluginName]: { rules } },
} satisfies Linter.Config<
  Record<`${typeof pluginName}/${keyof typeof rules}`, "error">
>;
