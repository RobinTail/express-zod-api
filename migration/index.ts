import {
  ESLintUtils,
  // AST_NODE_TYPES as NT,
  type TSESLint,
  // type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency

/*
type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier | TSESTree.StringLiteral;
};
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- temporary
interface Queries {}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {};

/*
const isNamedProp = (prop: TSESTree.ObjectLiteralElement): prop is NamedProp =>
  prop.type === NT.Property &&
  !prop.computed &&
  (prop.key.type === NT.Identifier ||
    (prop.key.type === NT.Literal && typeof prop.key.value === "string"));

const getPropName = (prop: NamedProp): string =>
  prop.key.type === NT.Identifier ? prop.key.name : prop.key.value;
*/

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

// eslint-disable-next-line no-restricted-syntax -- substituted by TSDOWN and vitest
const ruleName = `v${process.env.TSDOWN_VERSION?.split(".")[0] ?? "0"}`; // fail-safe for bumpp

const theRule = ESLintUtils.RuleCreator.withoutDocs({
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
  create: () => listen({}),
});

export default {
  rules: { [ruleName]: theRule } as Record<`v${number}`, typeof theRule>,
} satisfies TSESLint.Linter.Plugin;
