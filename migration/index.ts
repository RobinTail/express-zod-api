import {
  AST_NODE_TYPES as NT,
  ESLintUtils,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency
import { queryNamedProp, type NamedProp, getPropName } from "./helpers.ts";

interface Queries {
  integrationCreate: TSESTree.CallExpression;
  createServerAwait: TSESTree.CallExpression;
  asyncLifecycleHook: NamedProp;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  integrationCreate:
    `${NT.AwaitExpression} > ` +
    `${NT.CallExpression}[callee.object.name="Integration"][callee.property.name="create"]`,
  createServerAwait:
    `${NT.AwaitExpression} > ` +
    `${NT.CallExpression}[callee.name="createServer"]`,
  asyncLifecycleHook:
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("beforeRouting") +
    "," +
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("afterRouting"),
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

const ruleName = `v${process.env.TSDOWN_VERSION?.split(".")[0]}`;

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
    defaultOptions: [],
  },
  create: (ctx) =>
    listen({
      integrationCreate: (node) => {
        const parent = node.parent;
        if (!parent || parent.type !== NT.AwaitExpression) return;
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "Integration.create()",
            from: "await Integration.create()",
            to: "new Integration()",
          },
          fix: (fixer) => {
            const args = node.arguments
              .map((a) => ctx.sourceCode.getText(a))
              .join(", ");
            return fixer.replaceText(parent, `new Integration(${args})`);
          },
        });
      },
      createServerAwait: (node) => {
        const parent = node.parent;
        if (!parent || parent.type !== NT.AwaitExpression) return;
        ctx.report({
          node,
          messageId: "remove",
          data: { subject: "await from createServer()" },
          fix: (fixer) => {
            const text = ctx.sourceCode.getText(node);
            return fixer.replaceText(parent, text);
          },
        });
      },
      asyncLifecycleHook: (node) => {
        const value = node.value;
        const isAsync =
          (value.type === NT.ArrowFunctionExpression ||
            value.type === NT.FunctionExpression) &&
          value.async;
        if (!isAsync) return;
        const propName = getPropName(node);
        ctx.report({
          node,
          messageId: "remove",
          data: { subject: `async from ${propName}` },
          fix: (fixer) => {
            const firstToken = ctx.sourceCode.getFirstToken(value);
            if (!firstToken || firstToken.value !== "async") return null;
            const nextToken = ctx.sourceCode.getTokenAfter(firstToken);
            const end = nextToken
              ? nextToken.range[0]
              : firstToken.range[0] + 5;
            return fixer.removeRange([firstToken.range[0], end]);
          },
        });
      },
    }),
});

export default {
  rules: { [ruleName]: theRule } as Record<`v${number}`, typeof theRule>,
} satisfies TSESLint.Linter.Plugin;
