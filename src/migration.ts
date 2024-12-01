import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";
import { Method, methods } from "./method";

interface Queries {
  provide: TSESTree.CallExpression & {
    arguments: [
      TSESTree.Literal & { value: Method },
      TSESTree.Literal,
      TSESTree.ObjectExpression,
    ];
  };
}

const queries: Record<keyof Queries, string> = {
  provide:
    `${NT.CallExpression}[callee.property.name='provide'][arguments.length=3]` +
    `:has(${NT.Literal}[value=/^${methods.join("|")}$/] + ${NT.Literal} + ${NT.ObjectExpression})`,
};

const v22 = ESLintUtils.RuleCreator.withoutDocs({
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
    [queries.provide]: (node: Queries["provide"]) => {
      const {
        arguments: [method, path],
      } = node;
      const request = `"${method.value} ${path.value}"`;
      ctx.report({
        messageId: "change",
        node,
        data: {
          subject: "arguments",
          from: `"${method.value}", "${path.value}"`,
          to: request,
        },
        fix: (fixer) =>
          fixer.replaceTextRange([method.range[0], path.range[1]], request),
      });
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
  rules: { v22 },
} satisfies TSESLint.Linter.Plugin;
