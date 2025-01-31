import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";

interface Queries {
  placeholder: TSESTree.Identifier;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  placeholder: `${NT.Identifier}`,
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

const v23 = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {},
  },
  defaultOptions: [],
  create: () => listen({ placeholder: () => {} }),
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
  rules: { v23 },
} satisfies TSESLint.Linter.Plugin;
