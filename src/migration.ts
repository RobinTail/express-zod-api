import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";
import { Method, methods } from "./method";
import { name as self } from "../package.json";

interface Queries {
  provide: TSESTree.CallExpression & {
    arguments: [
      TSESTree.Literal & { value: Method },
      TSESTree.Literal,
      TSESTree.ObjectExpression,
    ];
  };
  splitResponse: TSESTree.Property & { key: TSESTree.Identifier };
  methodPath: TSESTree.ImportSpecifier & { imported: TSESTree.Identifier };
  createConfig: TSESTree.Property & {
    key: TSESTree.Identifier;
    value: TSESTree.ObjectExpression;
  };
  newDocs: TSESTree.ObjectExpression;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  provide:
    `${NT.CallExpression}[callee.property.name='provide'][arguments.length=3]` +
    `:has(${NT.Literal}[value=/^${methods.join("|")}$/] + ${NT.Literal} + ${NT.ObjectExpression})`,
  splitResponse:
    `${NT.NewExpression}[callee.name='Integration'] > ` +
    `${NT.ObjectExpression} > ${NT.Property}[key.name='splitResponse']`,
  methodPath: `${NT.ImportDeclaration} > ${NT.ImportSpecifier}[imported.name='MethodPath']`,
  createConfig:
    `${NT.CallExpression}[callee.name='createConfig'] > ${NT.ObjectExpression} > ` +
    `${NT.Property}[key.name='tags'][value.type='ObjectExpression']`,
  newDocs:
    `${NT.NewExpression}[callee.name='Documentation'] > ` +
    `${NT.ObjectExpression}[properties.length>0]:not(:has(>Property[key.name='tags']))`,
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

const v22 = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    fixable: "code",
    schema: [],
    messages: {
      add: `Add {{subject}} to {{to}}`,
      change: "Change {{subject}} {{from}} to {{to}}.",
      remove: "Remove {{subject}} {{name}}.",
    },
  },
  defaultOptions: [],
  create: (ctx) =>
    listen({
      provide: (node) => {
        const {
          arguments: [method, path],
        } = node;
        const request = `"${method.value} ${path.value}"`;
        ctx.report({
          messageId: "change",
          node,
          data: {
            subject: "arguments",
            from: `"${method.value}", "${path.value}"`,
            to: request,
          },
          fix: (fixer) =>
            fixer.replaceTextRange([method.range[0], path.range[1]], request),
        });
      },
      splitResponse: (node) =>
        ctx.report({
          messageId: "remove",
          node,
          data: { subject: "property", name: node.key.name },
          fix: (fixer) => fixer.remove(node),
        }),
      methodPath: (node) => {
        const replacement = "Request";
        ctx.report({
          messageId: "change",
          node: node.imported,
          data: { subject: "type", from: node.imported.name, to: replacement },
          fix: (fixer) => fixer.replaceText(node.imported, replacement),
        });
      },
      createConfig: (node) => {
        const props = node.value.properties
          .filter(
            (prop): prop is TSESTree.Property & { key: TSESTree.Identifier } =>
              "key" in prop && "name" in prop.key,
          )
          .map((prop) => `    "${prop.key.name}": unknown,\n`);
        ctx.report({
          messageId: "remove",
          node,
          data: { subject: "property", name: node.key.name },
          fix: (fixer) => [
            fixer.remove(node),
            fixer.insertTextAfter(
              ctx.sourceCode.ast,
              `\n// Declaring tag constraints\ndeclare module "${self}" {\n  interface TagOverrides {\n${props}  }\n}`,
            ),
          ],
        });
      },
      newDocs: (node) =>
        ctx.report({
          messageId: "add",
          node,
          data: { subject: "tags", to: "Documentation" },
          fix: (fixer) =>
            fixer.insertTextBefore(node.properties[0], "tags: {}, "),
        }),
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
  rules: { v22 },
} satisfies TSESLint.Linter.Plugin;
