import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency

type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier | TSESTree.StringLiteral;
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
  (prop.key.type === NT.Identifier ||
    (prop.key.type === NT.Literal && typeof prop.key.value === "string"));

const getPropName = (prop: NamedProp): string =>
  prop.key.type === NT.Identifier ? prop.key.name : prop.key.value;

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
        let isDeprecated = false;
        let nested: TSESTree.ObjectExpression | undefined = undefined;
        let target: TSESTree.Node = node;
        if (
          node.parent.type === NT.MemberExpression &&
          node.parent.property.type === NT.Identifier &&
          node.parent.parent.type === NT.CallExpression
        ) {
          target = node.parent.parent;
          if (node.parent.property.name === "deprecated") isDeprecated = true;
          if (
            node.parent.property.name === "nest" &&
            node.parent.parent.arguments[0] &&
            node.parent.parent.arguments[0].type === NT.ObjectExpression
          )
            nested = node.parent.parent.arguments[0];
        }
        ctx.report({
          node: target,
          messageId: "change",
          data: {
            subject: "value",
            from: "new DependsOnMethod(...)",
            to: "its argument object and append its keys with ' /'",
          },
          fix: (fixer) => {
            const makeMapper =
              (feat?: "deprecated" | "nest") =>
              (prop: TSESTree.ObjectLiteralElement) =>
                isNamedProp(prop)
                  ? `"${getPropName(prop)}${feat === "nest" ? "" : " /"}": ${ctx.sourceCode.getText(prop.value)}${feat === "deprecated" ? ".deprecated()" : ""},`
                  : `${ctx.sourceCode.getText(prop)}, /** @todo migrate manually */`;
            const nextProps = argument.properties
              .map(makeMapper(isDeprecated ? "deprecated" : undefined))
              .concat(nested?.properties.map(makeMapper("nest")) ?? [])
              .join("\n");
            return fixer.replaceText(target, `{\n${nextProps}\n}`);
          },
        });
      },
    }),
});

export default {
  rules: { v26 },
} satisfies TSESLint.Linter.Plugin;
