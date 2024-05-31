import type { TSESLint } from "@typescript-eslint/utils";

const pluginName = "ez-migration";

const rules = {
  "changed-imports": {
    defaultOptions: [],
    meta: {
      type: "suggestion",
      fixable: "code",
      messages: { entity: "Entity replaced, autofix available" },
      schema: [],
    },
    create(context) {
      return {
        ImportDeclaration(node) {
          const changes = {
            createLogger: "BuiltinLogger",
            createResultHandler: "ResultHandler",
          };
          if (node.source.value === "express-zod-api") {
            for (const spec of node.specifiers) {
              if (
                spec.type === "ImportSpecifier" &&
                spec.imported.name in changes
              ) {
                const change =
                  changes[spec.imported.name as keyof typeof changes];
                context.report({
                  node,
                  messageId: "entity",
                  fix: (fixer) => fixer.replaceText(spec, change),
                });
              }
            }
          }
        },
      };
    },
  } satisfies TSESLint.RuleModule<"entity">,
};

export const migration = {
  rules: {
    [`${pluginName}/changed-imports`]: "error",
  } satisfies Record<`${typeof pluginName}/${keyof typeof rules}`, "error">,
  plugins: { [pluginName]: { rules } },
};
