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
  wrongMethodBehavior: NamedProp;
  methodLikeRouteBehavior: NamedProp;
  hasSummaryFromDescription: NamedProp;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  wrongMethodBehavior:
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    `${NT.Property}[key.name="wrongMethodBehavior"]`,
  methodLikeRouteBehavior:
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    `${NT.Property}[key.name="methodLikeRouteBehavior"]`,
  hasSummaryFromDescription:
    `${NT.NewExpression}[callee.name="Documentation"] > ` +
    `${NT.ObjectExpression} > ` +
    `${NT.Property}[key.name="hasSummaryFromDescription"]`,
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
      wrongMethodBehavior: (node) => {
        const value = node.value;
        const newKey = "hintAllowedMethods";
        let newValue: string;
        if (value.type === NT.Literal && typeof value.value === "number")
          newValue = value.value === 405 ? "true" : "false";
        else if (value.type === NT.Identifier && value.name === "undefined")
          newValue = "undefined";
        else return;
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "property",
            from: "wrongMethodBehavior",
            to: newKey,
          },
          fix: (fixer) => [
            fixer.replaceText(node.key, newKey),
            fixer.replaceText(value, newValue),
          ],
        });
      },
      methodLikeRouteBehavior: (node) => {
        const value = node.value;
        const newKey = "recognizeMethodDependentRoutes";
        let newValue: string;
        if (value.type === NT.Identifier && value.name === "undefined")
          newValue = "undefined";
        else if (value.type === NT.Literal && typeof value.value === "string")
          newValue = value.value === "method" ? "true" : "false";
        else return;
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "property",
            from: "methodLikeRouteBehavior",
            to: newKey,
          },
          fix: (fixer) => [
            fixer.replaceText(node.key, newKey),
            fixer.replaceText(value, newValue),
          ],
        });
      },
      hasSummaryFromDescription: (node) => {
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "property",
            from: "hasSummaryFromDescription",
            to: "hasSummary",
          },
          fix: (fixer) => [fixer.replaceText(node.key, "hasSummary")],
        });
      },
    }),
});

export default {
  rules: { [ruleName]: theRule } as Record<`v${number}`, typeof theRule>,
} satisfies TSESLint.Linter.Plugin;
