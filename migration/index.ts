import {
  AST_NODE_TYPES as NT,
  ESLintUtils,
  type TSESLint,
  type TSESTree,
} from "@typescript-eslint/utils"; // eslint-disable-line allowed/dependencies -- assumed transitive dependency
import { queryNamedProp, type NamedProp, getPropName } from "./helpers.ts";

interface Queries {
  integrationCreate: TSESTree.CallExpression;
  createServerAwait: TSESTree.CallExpression;
  asyncLifecycleHook: NamedProp;
  documentationConfig: TSESTree.ObjectExpression;
  corsConfig: NamedProp;
  expressZodApiImport: TSESTree.ImportDeclaration;
  integrationNewTypescript: TSESTree.ObjectExpression;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  integrationCreate:
    `${NT.AwaitExpression} > ` +
    `${NT.CallExpression}[callee.object.name="Integration"][callee.property.name="create"]`,
  createServerAwait:
    `${NT.AwaitExpression} > ` +
    `${NT.CallExpression}[callee.name="createServer"]`,
  asyncLifecycleHook:
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("beforeRouting") +
    "," +
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("afterRouting"),
  documentationConfig:
    `${NT.NewExpression}[callee.name="Documentation"] > ` +
    `${NT.ObjectExpression}`,
  corsConfig:
    `${NT.CallExpression}[callee.name="createConfig"] > ` +
    `${NT.ObjectExpression} > ` +
    queryNamedProp("cors"),
  expressZodApiImport: `${NT.ImportDeclaration}[source.value="express-zod-api"]`,
  integrationNewTypescript:
    `${NT.NewExpression}[callee.name="Integration"] > ` +
    `${NT.ObjectExpression}`,
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
      integrationCreate: (node) => {
        const parent = node.parent;
        if (!parent || parent.type !== NT.AwaitExpression) return;
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "Integration.create()",
            from: "await Integration.create()",
            to: "new Integration()",
          },
          fix: (fixer) => {
            const args = node.arguments
              .map((a) => ctx.sourceCode.getText(a))
              .join(", ");
            return fixer.replaceText(parent, `new Integration(${args})`);
          },
        });
      },
      createServerAwait: (node) => {
        const parent = node.parent;
        if (!parent || parent.type !== NT.AwaitExpression) return;
        ctx.report({
          node,
          messageId: "remove",
          data: { subject: "await from createServer()" },
          fix: (fixer) => {
            const text = ctx.sourceCode.getText(node);
            return fixer.replaceText(parent, text);
          },
        });
      },
      asyncLifecycleHook: (node) => {
        const value = node.value;
        const isAsync =
          (value.type === NT.ArrowFunctionExpression ||
            value.type === NT.FunctionExpression) &&
          value.async;
        if (!isAsync) return;
        const propName = getPropName(node);
        ctx.report({
          node,
          messageId: "remove",
          data: { subject: `async from ${propName}` },
          fix: (fixer) => {
            const firstToken = ctx.sourceCode.getFirstToken(value);
            if (!firstToken || firstToken.value !== "async") return null;
            const nextToken = ctx.sourceCode.getTokenAfter(firstToken);
            const end = nextToken
              ? nextToken.range[0]
              : firstToken.range[0] + 5;
            return fixer.removeRange([firstToken.range[0], end]);
          },
        });
      },
      corsConfig: (node) => {
        const { value } = node;
        const isFunc =
          value.type === NT.ArrowFunctionExpression ||
          value.type === NT.FunctionExpression;
        if (!isFunc) return;
        const { body, async } = value;
        const asyncPrefix = async ? "async " : "";
        let newFunc: string | null = null;
        if (body.type === NT.ObjectExpression) {
          newFunc = `${asyncPrefix}(req, res, next) => { res.set(${ctx.sourceCode.getText(body)}); next(); }`;
        } else if (body.type === NT.BlockStatement) {
          const returnIndex = body.body.findIndex(
            (s) => s.type === NT.ReturnStatement,
          );
          if (returnIndex < 0) return;
          const ret = body.body[returnIndex] as TSESTree.ReturnStatement;
          if (!ret.argument || ret.argument.type !== NT.ObjectExpression)
            return;
          const parts: string[] = [];
          for (let i = 0; i < body.body.length; i++) {
            if (i === returnIndex) {
              parts.push(`res.set(${ctx.sourceCode.getText(ret.argument)});`);
              parts.push(`next();`);
            } else if (body.body[i]!.type !== NT.ReturnStatement) {
              parts.push(ctx.sourceCode.getText(body.body[i]!));
            }
          }
          newFunc = `${asyncPrefix}(req, res, next) => {\n${parts.join("\n")}\n}`;
        }
        if (!newFunc) return;
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "cors headers provider",
            from: "function returning object",
            to: "request handler",
          },
          fix: (fixer) => fixer.replaceText(value, newFunc),
        });
      },
      documentationConfig: (node) => {
        const parts: string[] = [];
        let infoItems: string[] | undefined = [];
        const changelog: Record<string, string> = {};

        for (const prop of node.properties) {
          if (prop.type !== NT.Property || prop.computed) {
            parts.push(ctx.sourceCode.getText(prop));
            continue;
          }
          const propName = getPropName(prop as NamedProp);
          if (propName === "info") {
            parts.push(ctx.sourceCode.getText(prop));
            infoItems = undefined;
          } else if (propName === "title" || propName === "version") {
            changelog["title, version"] = infoItems ? "info" : "";
            infoItems?.push(ctx.sourceCode.getText(prop));
          } else if (propName === "serverUrl") {
            parts.push(`server: ${ctx.sourceCode.getText(prop.value)}`);
            changelog.serverUrl = "server";
          } else {
            parts.push(ctx.sourceCode.getText(prop));
          }
        }

        const entries = Object.entries(changelog);
        if (!entries.length) return;

        if (infoItems?.length)
          parts.unshift(`info: { ${infoItems.join(", ")} }`);

        const oldText = ctx.sourceCode.getText(node);
        const newText = `{ ${parts.join(", ")} }`;
        if (oldText === newText) return;
        ctx.report({
          node,
          messageId: "change",
          data: {
            subject: "Documentation",
            from: entries.map(([k]) => k).join(", "),
            to: entries.map(([, v]) => v).join(", "),
          },
          fix: (fixer) => fixer.replaceText(node, newText),
        });
      },
      expressZodApiImport: (node) => {
        const targets: [string, string[]][] = [
          ["express-zod-api/integration", ["Integration", "Producer"]],
          ["express-zod-api/documentation", ["Documentation", "Depicter"]],
        ];
        const groups = new Map<string, TSESTree.ImportSpecifier[]>();
        const remaining: TSESTree.ImportSpecifier[] = [];
        const nonNamed: TSESTree.ImportDeclaration["specifiers"] = [];
        for (const spec of node.specifiers) {
          if (spec.type !== NT.ImportSpecifier) {
            nonNamed.push(spec);
            continue;
          }
          const name =
            spec.imported.type === NT.Identifier
              ? spec.imported.name
              : spec.imported.value;
          let found = false;
          for (const [target, names] of targets) {
            if (names.includes(name)) {
              if (!groups.has(target)) groups.set(target, []);
              groups.get(target)!.push(spec);
              found = true;
              break;
            }
          }
          if (!found) remaining.push(spec);
        }
        if (groups.size === 0) return;
        const importKind = node.importKind === "type" ? "type " : "";
        const first = groups.entries().next().value!;
        const firstName =
          first[1][0]!.imported.type === NT.Identifier
            ? first[1][0]!.imported.name
            : first[1][0]!.imported.value;
        ctx.report({
          node,
          messageId: "move",
          data: { subject: firstName, to: first[0] },
          fix: (fixer) => {
            const parts: string[] = [];
            const allMain = [...nonNamed, ...remaining];
            if (allMain.length > 0) {
              const text = allMain
                .map((s) => ctx.sourceCode.getText(s))
                .join(", ");
              parts.push(
                `import ${importKind}{ ${text} } from "express-zod-api"`,
              );
            }
            for (const [target, specs] of groups) {
              const text = specs
                .map((s) => ctx.sourceCode.getText(s))
                .join(", ");
              parts.push(`import ${importKind}{ ${text} } from "${target}"`);
            }
            return fixer.replaceText(node, parts.join("\n"));
          },
        });
      },
      integrationNewTypescript: (node) => {
        const typescriptProp = node.properties.find(
          (p) =>
            p.type === NT.Property &&
            p.key.type === NT.Identifier &&
            p.key.name === "typescript",
        );
        if (!typescriptProp) return;
        ctx.report({
          node,
          messageId: "remove",
          data: { subject: "typescript option" },
          fix: (fixer) => {
            const remaining = node.properties.filter(
              (p) => p !== typescriptProp,
            );
            const newText = remaining.length
              ? `{ ${remaining.map((p) => ctx.sourceCode.getText(p)).join(", ")} }`
              : "{}";
            return fixer.replaceText(node, newText);
          },
        });
      },
    }),
});

export default {
  rules: { [ruleName]: theRule } as Record<`v${number}`, typeof theRule>,
} satisfies TSESLint.Linter.Plugin;
