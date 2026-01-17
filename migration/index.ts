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
  integration: TSESTree.ObjectExpression;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  integration: `${NT.NewExpression}[callee.name="Integration"] > ${NT.ObjectExpression}`,
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

const ruleName = `v${process.env.TSDOWN_VERSION?.split(".")[0] ?? "0"}`; // fail-safe for bumpp

const theRule = ESLintUtils.RuleCreator.withoutDocs({
  name: ruleName,
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
      integration: (node) => {
        const tsProp = node.properties
          .filter(isNamedProp)
          .find((one) => getPropName(one) === "typescript");
        if (tsProp) return;
        const hasAsyncCtx = ctx.sourceCode
          .getAncestors(node)
          .some(
            (one) =>
              one.type === NT.AwaitExpression ||
              ((one.type === NT.ArrowFunctionExpression ||
                one.type === NT.FunctionExpression ||
                one.type === NT.FunctionDeclaration) &&
                one.async),
          );
        ctx.report(
          hasAsyncCtx
            ? {
                node: node.parent,
                messageId: "change",
                data: {
                  subject: "constructor",
                  from: "new Integration()",
                  to: "await Integration.create()",
                },
                fix: (fixer) =>
                  fixer.replaceText(
                    node.parent,
                    `(await Integration.create(${ctx.sourceCode.getText(node)}))`,
                  ),
              }
            : {
                node: node,
                messageId: "add",
                data: {
                  subject: "typescript property",
                  to: "constructor argument",
                },
                fix: (fixer) => [
                  fixer.insertTextBeforeRange(
                    ctx.sourceCode.ast.range,
                    `import typescript from "typescript";\n\n`,
                  ),
                  node.properties.length
                    ? fixer.insertTextBefore(node.properties[0], "typescript, ")
                    : fixer.replaceText(node, `{ typescript }`),
                ],
              },
        );
      },
    }),
});

export default {
  rules: { [ruleName]: theRule } as Record<`v${number}`, typeof theRule>,
} satisfies TSESLint.Linter.Plugin;
