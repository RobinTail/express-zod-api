import {
  ESLintUtils,
  // AST_NODE_TYPES as NT,
  type TSESLint,
  // type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency

/*
type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier;
};
 */

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- temporary
interface Queries {}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {};

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
  create: () => listen({}),
});

export default {
  rules: { v26 },
} satisfies TSESLint.Linter.Plugin;
