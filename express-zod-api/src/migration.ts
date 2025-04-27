import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- special case

interface Queries {
  numericRange: TSESTree.PropertyNonComputedName & { key: TSESTree.Identifier };
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  numericRange:
    `${NT.NewExpression}[callee.name='Documentation'] > ` +
    `${NT.ObjectExpression} > ${NT.Property}[key.name='numericRange']`,
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

const rangeWithComma = (
  node: TSESTree.Node,
  ctx: TSESLint.RuleContext<string, unknown[]>,
) =>
  [
    node.range[0],
    node.range[1] + (ctx.sourceCode.getTokenAfter(node)?.value === "," ? 1 : 0),
  ] as const;

const v24 = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {
      change: "change {{ subject }} from {{ from }} to {{ to }}",
      add: "add {{ subject }} to {{ to }}",
      move: "move {{ subject }} to {{ to }}",
      remove: "remove {{ subject }}",
    },
  },
  defaultOptions: [],
  create: (ctx) =>
    listen({
      numericRange: (node) =>
        ctx.report({
          node,
          messageId: "remove",
          data: { subject: node.key.name },
          fix: (fixer) => fixer.removeRange(rangeWithComma(node, ctx)),
        }),
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
 *            { files: ["**\/*.ts"], rules: { "migration/v24": "error" } }
 *          ];
 * */
export default {
  rules: { v24 },
} satisfies TSESLint.Linter.Plugin;
