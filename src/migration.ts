import {
  ESLintUtils,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";

const v21 = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {
      change: "Change {{subject}} {{from}} to {{to}}.",
    },
  },
  defaultOptions: [],
  create: (ctx) => ({
    CallExpression: (node) => {
      if (
        node.callee.type === "Identifier" &&
        node.callee.name === "createConfig" &&
        node.arguments.length === 1
      ) {
        const argument = node.arguments[0];
        if (argument.type === "ObjectExpression") {
          const serverProp = argument.properties.find(
            (entry): entry is TSESTree.Property =>
              entry.type === "Property" &&
              entry.key.type === "Identifier" &&
              entry.key.name === "server" &&
              entry.value.type === "ObjectExpression",
          );
          if (serverProp) {
            ctx.report({
              node: serverProp,
              messageId: "change",
              data: {
                subject: "property",
                from: "server",
                to: "http",
              },
              fix: (fixer) => fixer.replaceText(serverProp.key, "http"),
            });
          }
        }
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
