import {
  ESLintUtils,
  AST_NODE_TYPES as NT,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils";
import { name as importName } from "../package.json";

const createConfigName = "createConfig";
const createServerName = "createServer";
const serverPropName = "server";
const httpServerPropName = "httpServer";
const httpsServerPropName = "httpsServer";
const originalErrorPropName = "originalError";
const getStatusCodeFromErrorMethod = "getStatusCodeFromError";

const changedProps = {
  [serverPropName]: "http",
  [httpServerPropName]: "servers",
  [httpsServerPropName]: "servers",
  [originalErrorPropName]: "cause",
};

const changedMethods = {
  [getStatusCodeFromErrorMethod]: "ensureHttpError",
};

const movedProps = [
  "jsonParser",
  "upload",
  "compression",
  "rawParser",
  "beforeRouting",
] as const;

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

const v21 = ESLintUtils.RuleCreator.withoutDocs({
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
  create: (ctx) => ({
    [NT.ImportDeclaration]: (node) => {
      if (node.source.value === importName) {
        for (const spec of node.specifiers) {
          if (
            spec.type === "ImportSpecifier" &&
            spec.imported.type === "Identifier" &&
            spec.imported.name in changedMethods
          ) {
            const replacement =
              changedMethods[spec.imported.name as keyof typeof changedMethods];
            ctx.report({
              node: spec.imported,
              messageId: "change",
              data: {
                subject: "import",
                from: spec.imported.name,
                to: replacement,
              },
              fix: (fixer) => fixer.replaceText(spec, replacement),
            });
          }
        }
      }
    },
    [NT.MemberExpression]: (node) => {
      if (
        node.property.type === NT.Identifier &&
        node.property.name === originalErrorPropName &&
        node.object.type === NT.Identifier &&
        node.object.name.match(/err/i) // this is probably an error instance, but we don't do type checking
      ) {
        const replacement = changedProps[node.property.name];
        ctx.report({
          node: node.property,
          messageId: "change",
          data: {
            subject: "property",
            from: node.property.name,
            to: replacement,
          },
        });
      }
    },
    [NT.CallExpression]: (node) => {
      if (node.callee.type !== NT.Identifier) return;
      if (
        node.callee.name === createConfigName &&
        node.arguments.length === 1
      ) {
        const argument = node.arguments[0];
        if (argument.type === NT.ObjectExpression) {
          const serverProp = argument.properties.find(
            propByName(serverPropName),
          );
          if (serverProp) {
            const replacement = changedProps[serverProp.key.name];
            ctx.report({
              node: serverProp,
              messageId: "change",
              data: {
                subject: "property",
                from: serverProp.key.name,
                to: replacement,
              },
              fix: (fixer) => fixer.replaceText(serverProp.key, replacement),
            });
          }
          const httpProp = argument.properties.find(
            propByName(changedProps.server),
          );
          if (httpProp && httpProp.value.type === NT.ObjectExpression) {
            const nested = httpProp.value.properties;
            const movable = nested.filter(propByName(movedProps));
            for (const prop of movable) {
              const propText = ctx.sourceCode.text.slice(...prop.range);
              const comma = ctx.sourceCode.getTokenAfter(prop);
              ctx.report({
                node: httpProp,
                messageId: "move",
                data: {
                  subject: isPropWithId(prop) ? prop.key.name : "the property",
                  from: httpProp.key.name,
                  to: `the top level of ${node.callee.name} argument`,
                },
                fix: (fixer) => [
                  fixer.insertTextAfter(httpProp, `, ${propText}`),
                  fixer.removeRange([
                    prop.range[0],
                    comma?.value === "," ? comma.range[1] : prop.range[1],
                  ]),
                ],
              });
            }
          }
        }
      }
      if (node.callee.name === createServerName) {
        const assignment = ctx.sourceCode
          .getAncestors(node)
          .findLast(isAssignment);
        if (assignment) {
          const removable = assignment.id.properties.filter(
            propByName([httpServerPropName, httpsServerPropName] as const),
          );
          for (const prop of removable) {
            ctx.report({
              node: prop,
              messageId: "change",
              data: {
                subject: "property",
                from: prop.key.name,
                to: changedProps[prop.key.name],
              },
            });
          }
        }
      }
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
  rules: { v21 },
} satisfies TSESLint.Linter.Plugin;
