import {
  ESLintUtils,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";
import { complement } from "ramda";

const changedProps = {
  server: "http",
};

const propByName =
  <T extends string>(name: T) =>
  (
    entry: TSESTree.ObjectLiteralElement,
  ): entry is TSESTree.Property & {
    key: TSESTree.Identifier & { name: T };
  } =>
    entry.type === "Property" &&
    entry.key.type === "Identifier" &&
    entry.key.name === name;

const v21 = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {
      change: "Change {{subject}} {{from}} to {{to}}.",
      move: "Move {{subject}} from {{from}} to {{to}}.",
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
          const serverProp = argument.properties.find(propByName("server"));
          if (serverProp) {
            const replacement = changedProps[serverProp.key.name];
            ctx.report({
              node: serverProp,
              messageId: "change",
              data: {
                subject: "property",
                from: serverProp.key.name,
                to: replacement,
              },
              fix: (fixer) => fixer.replaceText(serverProp.key, replacement),
            });
          }
          const httpProp = argument.properties.find(
            propByName(changedProps.server),
          );
          if (httpProp && httpProp.value.type === "ObjectExpression") {
            const nested = httpProp.value.properties;
            const movable = nested.filter(complement(propByName("listen")));
            for (const prop of movable) {
              const propText = ctx.sourceCode.text.slice(
                prop.range[0],
                prop.range[1],
              );
              const comma = ctx.sourceCode.getTokenAfter(prop);
              ctx.report({
                node: httpProp,
                messageId: "move",
                data: {
                  subject:
                    prop.type === "Property" && prop.key.type === "Identifier"
                      ? prop.key.name
                      : "the property",
                  from: httpProp.key.name,
                  to: `the top level of ${node.callee.name} argument`,
                },
                fix: (fixer) => [
                  fixer.insertTextAfter(httpProp, `, ${propText}`),
                  fixer.removeRange([
                    prop.range[0],
                    comma?.value === "," ? comma.range[1] : prop.range[1],
                  ]),
                ],
              });
            }
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
