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
  splitResponse: TSESTree.Property & { key: TSESTree.Identifier };
  methodPath: TSESTree.ImportSpecifier & { imported: TSESTree.Identifier };
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  provide:
    `${NT.CallExpression}[callee.property.name='provide'][arguments.length=3]` +
    `:has(${NT.Literal}[value=/^${methods.join("|")}$/] + ${NT.Literal} + ${NT.ObjectExpression})`,
  splitResponse:
    `${NT.NewExpression}[callee.name='Integration'] > ` +
    `${NT.ObjectExpression} > ${NT.Property}[key.name='splitResponse']`,
  methodPath: `${NT.ImportDeclaration} > ${NT.ImportSpecifier}[imported.name='MethodPath']`,
};

const listen = <
  S extends { [K in Listener]: TSESLint.RuleFunction<Queries[K]> },
>(
  subject: S,
) =>
  (Object.keys(subject) as Listener[]).reduce<{ [K: string]: S[Listener] }>(
    (agg, key) =>
      Object.assign(agg, {
        [queries[key]]: subject[key],
      }),
    {},
  );

const v22 = ESLintUtils.RuleCreator.withoutDocs({
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
  create: (ctx) =>
    listen({
      provide: (node) => {
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
      splitResponse: (node) =>
        ctx.report({
          messageId: "remove",
          node,
          data: { subject: "property", name: node.key.name },
          fix: (fixer) => fixer.remove(node),
        }),
      methodPath: (node) => {
        const replacement = "Request";
        ctx.report({
          messageId: "change",
          node: node.imported,
          data: { subject: "type", from: node.imported.name, to: replacement },
          fix: (fixer) => fixer.replaceText(node.imported, replacement),
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
