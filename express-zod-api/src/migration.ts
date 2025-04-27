import {
  ESLintUtils,
  // AST_NODE_TYPES as NT,
  type TSESLint,
  // type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- special case

// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- @todo
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

const v24 = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {
      change: "change {{ subject }} from {{ from }} to {{ to }}",
      add: `add {{ subject }} to {{ to }}`,
      move: "move {{ subject }} to {{ to }}",
    },
  },
  defaultOptions: [],
  create: () => listen({}),
});

/**
 * @desc ESLint plugin for migrating to this version (from previous), requires eslint v9 and typescript-eslint v8
 * @deprecated Single-use tool that can be removed and changed regardless SemVer. Remember to delete it after use.
 * @example
 *          // eslint.config.mjs:
 *          import parser from "@typescript-eslint/parser";
 *          import migration from "express-zod-api/migration";
 *          export default [
 *            { languageOptions: {parser}, plugins: {migration} },
 *            { files: ["**\/*.ts"], rules: { "migration/v21": "error" } }
 *          ];
 * */
export default {
  rules: { v24 },
} satisfies TSESLint.Linter.Plugin;
