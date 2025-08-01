import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency

type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier;
};

interface Queries {
  zod: TSESTree.ImportDeclaration;
  dateInOutExample: NamedProp;
  getExamples: TSESTree.CallExpression;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  zod: `${NT.ImportDeclaration}[source.value='zod/v4']`,
  dateInOutExample:
    `${NT.CallExpression}[callee.object.name='ez'][callee.property.name=/date(In|Out)/] >` +
    `${NT.ObjectExpression} > ${NT.Property}[key.name='example']`,
  getExamples: `${NT.CallExpression}[callee.name='getExamples']`,
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
      dateInOutExample: (node) =>
        ctx.report({
          node,
          messageId: "change",
          data: { subject: "property", from: "example", to: "examples" },
          fix: (fixer) =>
            fixer.replaceText(
              node,
              `examples: [${ctx.sourceCode.getText(node.value)}]`,
            ),
        }),
      getExamples: (node) =>
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "method",
            from: "getExamples()",
            to: ".meta()?.examples || []",
          },
          fix: (fixer) =>
            fixer.replaceText(
              node,
              `(${ctx.sourceCode.getText(node.arguments[0])}.meta()?.examples || [])`,
            ),
        }),
    }),
});

export default {
  rules: { v25 },
} satisfies TSESLint.Linter.Plugin;
