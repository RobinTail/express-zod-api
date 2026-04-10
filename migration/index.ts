import {
  AST_NODE_TYPES as NT,
  ESLintUtils,
  type TSESLint,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency
import {
  queryNamedProp,
  type NamedProp,
  getPropName,
  changeProp,
} from "./helpers.ts";

interface Queries {
  wrongMethodBehavior: NamedProp;
  methodLikeRouteBehavior: NamedProp;
  hasSummaryFromDescription: NamedProp;
  noContent: NamedProp;
  shortDescription: NamedProp;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  wrongMethodBehavior:
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("wrongMethodBehavior"),
  methodLikeRouteBehavior:
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("methodLikeRouteBehavior"),
  hasSummaryFromDescription:
    `${NT.NewExpression}[callee.name="Documentation"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("hasSummaryFromDescription"),
  noContent:
    `${NT.NewExpression}[callee.name="Integration"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("noContent"),
  shortDescription:
    `${NT.CallExpression}[callee.property.name=/build|buildVoid/] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("shortDescription"),
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
    defaultOptions: [],
  },
  create: (ctx) =>
    listen({
      wrongMethodBehavior: (node) =>
        changeProp({
          ctx,
          node,
          to: "hintAllowedMethods",
          assign: (value) => {
            if (value.type === NT.Literal && typeof value.value === "number")
              return value.value === 405 ? "true" : "false";
            else if (value.type === NT.Identifier && value.name === "undefined")
              return "undefined";
            else return null;
          },
        }),
      methodLikeRouteBehavior: (node) =>
        changeProp({
          ctx,
          node,
          to: "recognizeMethodDependentRoutes",
          assign: (value) => {
            if (value.type === NT.Identifier && value.name === "undefined")
              return "undefined";
            else if (
              value.type === NT.Literal &&
              typeof value.value === "string"
            )
              return value.value === "method" ? "true" : "false";
            else return null;
          },
        }),
      hasSummaryFromDescription: (node) => {
        const value = node.value;
        const isDisabled = value.type === NT.Literal && value.value === false;
        ctx.report({
          node,
          messageId: isDisabled ? "change" : "remove",
          data: {
            subject: "property",
            ...(isDisabled && {
              from: getPropName(node),
              to: "summarizer",
            }),
          },
          fix: (fixer) => {
            if (isDisabled) {
              return fixer.replaceText(
                node,
                "summarizer: ({ summary, trim }) => trim(summary)",
              );
            }
            const after = ctx.sourceCode.getTokenAfter(node);
            const end = node.range[1] + (after?.value === "," ? 1 : 0);
            return fixer.removeRange([node.range[0], end]);
          },
        });
      },
      noContent: (node) => changeProp({ ctx, node, to: "noBodySchema" }),
      shortDescription: (node) => changeProp({ ctx, node, to: "summary" }),
    }),
});

export default {
  rules: { [ruleName]: theRule } as Record<`v${number}`, typeof theRule>,
} satisfies TSESLint.Linter.Plugin;
