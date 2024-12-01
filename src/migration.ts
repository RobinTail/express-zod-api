import {
  ESLintUtils,
  // AST_NODE_TYPES as NT,
  type TSESLint,
  // type TSESTree,
} from "@typescript-eslint/utils";
// import { name as importName } from "../package.json";

/*
type PropWithId = TSESTree.Property & {
  key: TSESTree.Identifier;
};

const isPropWithId = (subject: TSESTree.Node): subject is PropWithId =>
  subject.type === NT.Property && subject.key.type === NT.Identifier;

const isAssignment = (
  parent: TSESTree.Node,
): parent is TSESTree.VariableDeclarator & { id: TSESTree.ObjectPattern } =>
  parent.type === NT.VariableDeclarator && parent.id.type === NT.ObjectPattern;

const propByName =
  <T extends string>(subject: T | ReadonlyArray<T>) =>
  (entry: TSESTree.Node): entry is PropWithId & { key: { name: T } } =>
    isPropWithId(entry) &&
    (Array.isArray(subject)
      ? subject.includes(entry.key.name)
      : entry.key.name === subject);
*/

const v22 = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {
      change: "Change {{subject}} {{from}} to {{to}}.",
      move: "Move {{subject}} from {{from}} to {{to}}.",
    },
  },
  defaultOptions: [],
  create: () => ({}),
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
  rules: { v22 },
} satisfies TSESLint.Linter.Plugin;
