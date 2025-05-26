import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- special case

type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier;
};

interface Queries {
  numericRange: NamedProp;
  optionalPropStyle: NamedProp;
  depicter: TSESTree.ArrowFunctionExpression;
  nextCall: TSESTree.CallExpression;
  zod: TSESTree.ImportDeclaration;
  ezFile: TSESTree.CallExpression & { arguments: [TSESTree.Literal] };
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  numericRange:
    `${NT.NewExpression}[callee.name='Documentation'] > ` +
    `${NT.ObjectExpression} > ${NT.Property}[key.name='numericRange']`,
  optionalPropStyle:
    `${NT.NewExpression}[callee.name='Integration'] > ` +
    `${NT.ObjectExpression} > ${NT.Property}[key.name='optionalPropStyle']`,
  depicter:
    `${NT.VariableDeclarator}[id.typeAnnotation.typeAnnotation.typeName.name='Depicter'] > ` +
    `${NT.ArrowFunctionExpression}`,
  nextCall:
    `${NT.VariableDeclarator}[id.typeAnnotation.typeAnnotation.typeName.name='Depicter'] > ` +
    `${NT.ArrowFunctionExpression} ${NT.CallExpression}[callee.name='next']`,
  zod: `${NT.ImportDeclaration}[source.value='zod']`,
  ezFile: `${NT.CallExpression}[arguments.0.type='${NT.Literal}']:has( ${NT.MemberExpression}[object.name='ez'][property.name='file'] )`,
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

const rangeWithComma = (
  node: TSESTree.Node,
  ctx: TSESLint.RuleContext<string, unknown[]>,
) =>
  [
    node.range[0],
    node.range[1] + (ctx.sourceCode.getTokenAfter(node)?.value === "," ? 1 : 0),
  ] as const;

const propRemover =
  (ctx: TSESLint.RuleContext<string, unknown[]>) => (node: NamedProp) =>
    ctx.report({
      node,
      messageId: "remove",
      data: { subject: node.key.name },
      fix: (fixer) => fixer.removeRange(rangeWithComma(node, ctx)),
    });

const v24 = ESLintUtils.RuleCreator.withoutDocs({
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
  create: (ctx) =>
    listen({
      numericRange: propRemover(ctx),
      optionalPropStyle: propRemover(ctx),
      depicter: (node) => {
        const [first, second] = node.params;
        if (first?.type !== NT.Identifier) return;
        const zodSchemaAlias = first.name;
        if (second?.type !== NT.ObjectPattern) return;
        const nextFn = second.properties.find(
          (one) =>
            one.type === NT.Property &&
            one.key.type === NT.Identifier &&
            one.key.name === "next",
        );
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "arguments",
            from: `[${zodSchemaAlias}, { next, ...rest }]`,
            to: `[{ zodSchema: ${zodSchemaAlias}, jsonSchema }, { ...rest }]`,
          },
          fix: (fixer) => {
            const fixes = [
              fixer.replaceText(
                first,
                `{ zodSchema: ${zodSchemaAlias}, jsonSchema }`,
              ),
            ];
            if (nextFn)
              fixes.push(fixer.removeRange(rangeWithComma(nextFn, ctx)));
            return fixes;
          },
        });
      },
      nextCall: (node) =>
        ctx.report({
          node,
          messageId: "change",
          data: { subject: "statement", from: "next()", to: "jsonSchema" },
          fix: (fixer) => fixer.replaceText(node, "jsonSchema"),
        }),
      zod: (node) =>
        ctx.report({
          node: node.source,
          messageId: "change",
          data: { subject: "import", from: "zod", to: "zod/v4" },
          fix: (fixer) => fixer.replaceText(node.source, `"zod/v4"`),
        }),
      ezFile: (node) => {
        const [variant] = node.arguments;
        const replacement =
          variant.value === "buffer"
            ? "ez.buffer()"
            : variant.value === "base64"
              ? "z.base64()"
              : variant.value === "binary"
                ? "ez.buffer().or(z.string())"
                : "z.string()";
        ctx.report({
          node: node,
          messageId: "change",
          data: { subject: "schema", from: "ez.file()", to: replacement },
          fix: (fixer) => fixer.replaceText(node, replacement),
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
 *            { files: ["**\/*.ts"], rules: { "migration/v24": "error" } }
 *          ];
 * */
export default {
  rules: { v24 },
} satisfies TSESLint.Linter.Plugin;
