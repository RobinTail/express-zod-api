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
  dependsOnMethod: TSESTree.NewExpression;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  dependsOnMethod: `${NT.NewExpression}[callee.name='DependsOnMethod']`,
};

const isNamedProp = (prop: TSESTree.ObjectLiteralElement): prop is NamedProp =>
  prop.type === NT.Property &&
  !prop.computed &&
  prop.key.type === NT.Identifier;

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

const v26 = ESLintUtils.RuleCreator.withoutDocs({
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
      dependsOnMethod: (node) => {
        if (node.arguments.length !== 1) return;
        const argument = node.arguments[0];
        if (argument.type !== NT.ObjectExpression) return;
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "value",
            from: "new DependsOnMethod(...)",
            to: "its argument object and append its keys with ' /'",
          },
          fix: (fixer) => {
            const nextProps = argument.properties
              .map((prop) =>
                isNamedProp(prop)
                  ? `"${prop.key.name} /": ${ctx.sourceCode.getText(prop.value)},`
                  : `${ctx.sourceCode.getText(prop)}, /** @todo migrate manually */`,
              )
              .join("\n");
            return fixer.replaceText(node, `{\n${nextProps}\n}`);
          },
        });
      },
    }),
});

export default {
  rules: { v26 },
} satisfies TSESLint.Linter.Plugin;
