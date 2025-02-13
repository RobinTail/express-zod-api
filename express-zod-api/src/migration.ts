import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";

interface Queries {
  headerSecurity: TSESTree.Identifier;
  createConfig: TSESTree.ObjectExpression;
  getters: TSESTree.CallExpression & {
    callee: TSESTree.MemberExpression & { property: TSESTree.Identifier };
  };
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  headerSecurity: `${NT.Identifier}[name='CustomHeaderSecurity']`,
  createConfig: `${NT.CallExpression}[callee.name='createConfig'] > ${NT.ObjectExpression}`,
  getters:
    `${NT.CallExpression}:has(` +
    `>${NT.MemberExpression}[property.name=/get(Description|Schema|Methods|Tags|Scopes|Security|RequestType)/])`,
};

const getters = {
  getMethods: "methods",
  getTags: "tags",
  getScopes: "scopes",
  getSecurity: "security",
  getRequestType: "requestType",
  getDescription: (argument?: TSESTree.CallExpressionArgument) =>
    argument && argument.type === NT.Literal && argument.value === "short"
      ? "shortDescription"
      : "description",
  getSchema: (argument?: TSESTree.CallExpressionArgument) =>
    argument
      ? argument.type === NT.Literal && argument.value === "output"
        ? "outputSchema"
        : "inputSchema"
      : "schema",
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
    messages: {
      change: "change {{ subject }} from {{ from }} to {{ to }}",
      add: `add {{ subject }} to {{ to }}`,
    },
  },
  defaultOptions: [],
  create: (ctx) =>
    listen({
      headerSecurity: (node) =>
        ctx.report({
          node,
          messageId: "change",
          data: { subject: "interface", from: node.name, to: "HeaderSecurity" },
          fix: (fixer) => fixer.replaceText(node, "HeaderSecurity"),
        }),
      createConfig: (node) => {
        const wmProp = node.properties.find(
          (prop) =>
            prop.type === NT.Property &&
            prop.key.type === NT.Identifier &&
            prop.key.name === "wrongMethodBehavior",
        );
        if (wmProp) return;
        ctx.report({
          node,
          messageId: "add",
          data: {
            subject: "wrongMethodBehavior property",
            to: "configuration",
          },
          fix: (fixer) =>
            fixer.insertTextAfterRange(
              [node.range[0], node.range[0] + 1],
              "wrongMethodBehavior: 404,",
            ),
        });
      },
      getters: (node) => {
        const method = node.callee.property.name;
        if (node.arguments.length > 1) return;
        const [argument] = node.arguments;
        const replacement = getters[method as keyof typeof getters];
        if (!replacement) return;
        const getter =
          typeof replacement === "function"
            ? replacement(argument)
            : replacement;
        ctx.report({
          node: node.callee.property,
          messageId: "change",
          data: { subject: "method", from: method, to: `${getter} property` },
          fix: (fixer) => [
            fixer.removeRange([node.callee.range[1], node.range[1]]), // (...args)
            fixer.replaceText(node.callee.property, getter),
          ],
        });
      },
    }),
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
