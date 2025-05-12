import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- special case

interface Queries {
  headerSecurity: TSESTree.Identifier;
  createConfig: TSESTree.ObjectExpression;
  testMiddleware: TSESTree.ObjectExpression;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  headerSecurity: `${NT.Identifier}[name='CustomHeaderSecurity']`,
  createConfig: `${NT.CallExpression}[callee.name='createConfig'] > ${NT.ObjectExpression}`,
  testMiddleware: `${NT.CallExpression}[callee.name='testMiddleware'] > ${NT.ObjectExpression}`,
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
      move: "move {{ subject }} to {{ to }}",
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
      testMiddleware: (node) => {
        const ehProp = node.properties.find(
          (
            prop,
          ): prop is TSESTree.Property & {
            value:
              | TSESTree.ArrowFunctionExpression
              | TSESTree.FunctionExpression;
          } =>
            prop.type === NT.Property &&
            prop.key.type === NT.Identifier &&
            prop.key.name === "errorHandler" &&
            [NT.ArrowFunctionExpression, NT.FunctionExpression].includes(
              prop.value.type,
            ),
        );
        if (!ehProp) return;
        const hasComma = ctx.sourceCode.getTokenAfter(ehProp)?.value === ",";
        const { body } = ehProp.value;
        const configProp = node.properties.find(
          (
            prop,
          ): prop is TSESTree.Property & { value: TSESTree.ObjectExpression } =>
            prop.type === NT.Property &&
            prop.key.type === NT.Identifier &&
            prop.key.name === "configProps" &&
            prop.value.type === NT.ObjectExpression,
        );
        const replacement = `errorHandler: new ResultHandler({ positive: [], negative: [], handler: ({ error, response }) => {${ctx.sourceCode.getText(body)}} }),`;
        ctx.report({
          node: ehProp,
          messageId: "move",
          data: { subject: "errorHandler", to: "configProps" },
          fix: (fixer) => [
            fixer.removeRange([
              ehProp.range[0],
              ehProp.range[1] + (hasComma ? 1 : 0),
            ]),
            configProp
              ? fixer.insertTextAfterRange(
                  [configProp.value.range[0], configProp.value.range[0] + 1],
                  replacement,
                )
              : fixer.insertTextAfterRange(
                  [node.range[0], node.range[0] + 1],
                  `configProps: {${replacement}},`,
                ),
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
