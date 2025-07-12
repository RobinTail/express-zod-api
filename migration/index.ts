import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency

/*
type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier;
};
*/

interface Queries {
  zod: TSESTree.ImportDeclaration;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  zod: `${NT.ImportDeclaration}[source.value='zod/v4']`,
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

/*
const rangeWithComma = (
  node: TSESTree.Node,
  ctx: TSESLint.RuleContext<string, unknown[]>,
) =>
  [
    node.range[0],
    node.range[1] + (ctx.sourceCode.getTokenAfter(node)?.value === "," ? 1 : 0),
  ] as const;

const propRemover =
  (ctx: TSESLint.RuleContext<string, unknown[]>) => (node: NamedProp) =>
    ctx.report({
      node,
      messageId: "remove",
      data: { subject: node.key.name },
      fix: (fixer) => fixer.removeRange(rangeWithComma(node, ctx)),
    });
*/

const v25 = ESLintUtils.RuleCreator.withoutDocs({
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
      zod: (node) =>
        ctx.report({
          node: node.source,
          messageId: "change",
          data: { subject: "import", from: "zod/v4", to: "zod" },
          fix: (fixer) => fixer.replaceText(node.source, `"zod"`),
        }),
    }),
});

export default {
  rules: { v25 },
} satisfies TSESLint.Linter.Plugin;
