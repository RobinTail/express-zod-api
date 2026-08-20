import {
  type ESTree,
  eslintCompatPlugin,
  type Rule,
  type Visitor,
} from "@oxlint/plugins";

interface Queries {
  expressZodApiImport: ESTree.ImportDeclaration;
  defaultId: ESTree.IdentifierName;
}

type Listener = keyof Queries;

const queries: Record<Listener, string> = {
  expressZodApiImport: `ImportDeclaration[source.value="express-zod-api"]`,
  defaultId: `Identifier[name]`,
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

const moveTargets = new Map<string, string[]>([
  ["express-zod-api/documentation", ["DocumentationError"]],
]);

const renameTargets = new Map([
  ["defaultResultHandler", "legacyResultHandler"],
  ["defaultEndpointsFactory", "legacyEndpointsFactory"],
]);

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
      expressZodApiImport: (node) => {
        const groups = new Map<string, ESTree.ImportSpecifier[]>();
        const remaining: ESTree.ImportSpecifier[] = [];
        const nonNamed: ESTree.ImportDeclaration["specifiers"] = [];
        for (const spec of node.specifiers) {
          if (spec.type !== "ImportSpecifier") {
            nonNamed.push(spec);
            continue;
          }
          const name =
            spec.imported.type === "Identifier"
              ? spec.imported.name
              : spec.imported.value;
          let found = false;
          for (const [target, names] of moveTargets) {
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
          first[1][0]!.imported.type === "Identifier"
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
      defaultId: (node) => {
        const replacement = renameTargets.get(node.name);
        if (!replacement) return;
        ctx.report({
          node,
          messageId: "change",
          data: { subject: "entity", from: node.name, to: replacement },
          fix: (fixer) => fixer.replaceText(node, replacement),
        });
      },
    }),
};

export default eslintCompatPlugin({
  rules: { [ruleName]: theRule },
});
