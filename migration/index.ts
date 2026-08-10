import { hasImport, getRangeWithComma } from "./helpers.ts";
import {
  type ESTree,
  eslintCompatPlugin,
  type Rule,
  type Visitor,
} from "@oxlint/plugins";

interface Queries {
  legacyImport: ESTree.ImportSpecifier & { imported: ESTree.IdentifierName };
  provideCall: ESTree.CallExpression;
  clientNew: ESTree.NewExpression;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  legacyImport: `ImportSpecifier[imported.name=/^default(ResultHandler|EndpointsFactory)$/]`,
  provideCall: `CallExpression[callee.property.name="provide"]`,
  clientNew: `NewExpression[callee.name="Client"][arguments.length>0]`,
};

const listen = <S extends { [K in Listener]: (node: Queries[K]) => void }>(
  subject: S,
) =>
  (Object.keys(subject) as Listener[]).reduce<Visitor>(
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

const ruleName = `v${import.meta.TSDOWN_VERSION.split(".")[0]}`;

const theRule: Rule = {
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
            if (declaration.type !== "ImportDeclaration") return null;
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
        const { parent } = node;
        if (
          parent.type === "AwaitExpression" &&
          parent.parent.type === "VariableDeclarator"
        ) {
          const declarator = parent.parent;
          if (!declarator.id || declarator.id.type !== "Identifier") return;
          const oldName = ctx.sourceCode.getText(declarator.id);
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
                declarator.parent,
                `/** @todo discriminate by status === 200 instead of response.status === "success" */\n`,
              ),
              fixer.replaceText(declarator.id, `[status, ${oldName}]`),
            ],
          });
        } else if (
          parent.type === "MemberExpression" &&
          parent.property.type === "Identifier" &&
          parent.property.name === "then" &&
          parent.parent.type === "CallExpression"
        ) {
          const thenCall = parent.parent;
          const callback = thenCall.arguments[0];
          if (
            !callback ||
            (callback.type !== "ArrowFunctionExpression" &&
              callback.type !== "FunctionExpression")
          )
            return;
          const param = callback.params[0];
          if (!param || param.type !== "Identifier") return;
          const oldName = ctx.sourceCode.getText(param);
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
        let body: ESTree.BlockStatement | undefined;
        if (
          impl &&
          (impl.type === "ArrowFunctionExpression" ||
            impl.type === "FunctionExpression") &&
          impl.body?.type === "BlockStatement"
        )
          body = impl.body;

        if (!body) return;
        const sourceCode = ctx.sourceCode;
        for (const stmt of body.body) {
          if (stmt.type !== "ReturnStatement") continue;
          const retArg = stmt.argument;
          if (!retArg) continue;
          const argSource = sourceCode.getText(retArg);
          const hasAwait = retArg.type === "AwaitExpression";
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
};

export default eslintCompatPlugin({
  rules: { [ruleName]: theRule },
});
