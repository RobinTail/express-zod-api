import { hasImport, getRangeWithComma } from "./helpers.ts";
import {
  AST_NODE_TYPES as NT,
  ESLintUtils,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency

interface Queries {
  legacyImport: TSESTree.ImportSpecifier & { imported: TSESTree.Identifier };
  provideCall: TSESTree.CallExpression;
  clientNew: TSESTree.NewExpression;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  legacyImport: `ImportSpecifier[imported.name=/^default(ResultHandler|EndpointsFactory)$/]`,
  provideCall: `CallExpression[callee.property.name="provide"]`,
  clientNew: `NewExpression[callee.name="Client"][arguments.length>0]`,
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

const legacyHandlerCode = [
  "export const legacyResultHandler = new ResultHandler({",
  '  positive: (output) => z.object({ status: z.literal("success"), data: output }),',
  "  negative: z.object({",
  '    status: z.literal("error"),',
  "    error: z.object({ message: z.string() }),",
  "  }),",
  "  handler: ({ error, input, output, request, response, logger }) => {",
  "    if (error) {",
  "      const httpError = ensureHttpError(error);",
  "      return void response",
  "        .status(httpError.statusCode)",
  "        .set(httpError.headers)",
  "        .json({",
  '          status: "error",',
  "          // @todo ensure it's appropriate to expose the error message",
  "          error: { message: httpError.message },",
  "        });",
  "    }",
  "    response.status(200)",
  '      .json({ status: "success", data: output });',
  "  },",
  "});",
].join("\n");

const ruleName = `v${process.env.TSDOWN_VERSION?.split(".")[0]}`;

const theRule = ESLintUtils.RuleCreator.withoutDocs({
  name: ruleName,
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
    defaultOptions: [],
  },
  create: (ctx) =>
    listen({
      legacyImport: (node) => {
        const { name: importName } = node.imported;
        const replacement = importName.replace("default", "legacy");
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "import",
            from: importName,
            to: replacement,
          },
          fix: (fixer) => {
            const { parent: declaration } = node;
            if (declaration.type !== NT.ImportDeclaration) return null;
            const lines: string[] = [];
            if (!hasImport(ctx, "zod")) lines.push(`import { z } from "zod";`);
            const needed = ["ResultHandler", "ensureHttpError"]
              .concat(
                importName === "defaultEndpointsFactory"
                  ? ["EndpointsFactory"]
                  : [],
              )
              .filter((n) => !hasImport(ctx, "express-zod-api", n));
            if (needed.length) {
              lines.push(
                `import { ${needed.join(", ")} } from "express-zod-api";`,
              );
            }
            lines.push(legacyHandlerCode);
            if (importName === "defaultEndpointsFactory") {
              lines.push(
                `export const legacyEndpointsFactory = new EndpointsFactory(legacyResultHandler);`,
              );
            }
            const remaining = declaration.specifiers.filter((s) => s !== node);
            if (remaining.length) {
              return [
                fixer.removeRange(getRangeWithComma(ctx, node)),
                fixer.insertTextAfterRange(
                  declaration.range,
                  `\n\n${lines.join("\n")}`,
                ),
              ];
            }
            return fixer.replaceTextRange(declaration.range, lines.join("\n"));
          },
        });
      },
      provideCall: (node) => {
        const sourceCode = ctx.sourceCode;
        const parent = node.parent;
        if (
          parent.type === NT.AwaitExpression &&
          parent.parent.type === NT.VariableDeclarator
        ) {
          const declarator = parent.parent;
          const varDecl = declarator.parent as TSESTree.VariableDeclaration;
          if (!declarator.id || declarator.id.type !== NT.Identifier) return;
          const oldName = sourceCode.getText(declarator.id);
          ctx.report({
            node,
            messageId: "change",
            data: {
              subject: "assignment",
              from: `${oldName} = await client.provide(`,
              to: `[status, ${oldName}] = await client.provide(`,
            },
            fix: (fixer) => [
              fixer.insertTextBefore(
                varDecl,
                `/** @todo discriminate by status === 200 instead of response.status === "success" */\n`,
              ),
              fixer.replaceText(declarator.id, `[status, ${oldName}]`),
            ],
          });
        } else if (
          parent.type === NT.MemberExpression &&
          parent.property.type === NT.Identifier &&
          parent.property.name === "then" &&
          parent.parent.type === NT.CallExpression
        ) {
          const thenCall = parent.parent;
          const callback = thenCall.arguments[0];
          if (
            !callback ||
            (callback.type !== NT.ArrowFunctionExpression &&
              callback.type !== NT.FunctionExpression)
          )
            return;
          const param = callback.params[0];
          if (!param || param.type !== NT.Identifier) return;
          const oldName = sourceCode.getText(param);
          ctx.report({
            node,
            messageId: "change",
            data: {
              subject: "callback",
              from: `(${oldName}) =>`,
              to: `([status, ${oldName}]) =>`,
            },
            fix: (fixer) => [
              fixer.insertTextBefore(
                param,
                `/** @todo discriminate by status === 200 instead of response.status === "success" */\n`,
              ),
              fixer.replaceText(param, `[status, ${oldName}]`),
            ],
          });
        }
      },
      clientNew: (node) => {
        const impl = node.arguments[0];
        let body: TSESTree.BlockStatement | undefined;
        if (
          impl &&
          (impl.type === NT.ArrowFunctionExpression ||
            impl.type === NT.FunctionExpression) &&
          impl.body.type === NT.BlockStatement
        )
          body = impl.body;

        if (!body) return;
        const sourceCode = ctx.sourceCode;
        for (const stmt of body.body) {
          if (stmt.type !== NT.ReturnStatement) continue;
          const retArg = stmt.argument;
          if (!retArg) continue;
          const argSource = sourceCode.getText(retArg);
          const hasAwait = retArg.type === NT.AwaitExpression;
          ctx.report({
            node: stmt,
            messageId: "change",
            data: {
              subject: "return",
              from: `return ${argSource}`,
              to: `return [response.status, ${hasAwait ? argSource : `await ${argSource}`}]`,
            },
            fix: (fixer) => [
              fixer.insertTextBefore(
                stmt,
                `/** @todo ensure response.status is the status-code in the first place of this tuple */\n`,
              ),
              fixer.replaceText(
                retArg,
                `[response.status, ${hasAwait ? "" : "await "}${argSource}]`,
              ),
            ],
          });
        }
      },
    }),
});

export default {
  rules: { [ruleName]: theRule } as Record<`v${number}`, typeof theRule>,
} satisfies TSESLint.Linter.Plugin;
