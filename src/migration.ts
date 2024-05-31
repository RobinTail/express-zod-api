import type { TSESLint } from "@typescript-eslint/utils";

const pluginName = "ez-migration";

const rules = {
  "changed-imports": {
    defaultOptions: [],
    meta: {
      type: "suggestion",
      fixable: "code",
      messages: { builtinLogger: "createLogger —> BuiltinLogger" },
      schema: [],
    },
    create(context) {
      return {
        ImportDeclaration(node) {
          if (node.source.value === "express-zod-api") {
            const spec = node.specifiers.find(
              (spec) =>
                spec.type === "ImportSpecifier" &&
                spec.imported.name === "createLogger",
            );
            if (spec) {
              context.report({
                node,
                messageId: "builtinLogger",
                fix: (fixer) => fixer.replaceText(spec, "BuiltinLogger"),
              });
            }
          }
        },
      };
    },
  } satisfies TSESLint.RuleModule<"builtinLogger">,
};

export const migration = {
  rules: {
    [`${pluginName}/changed-imports`]: "error",
  } satisfies Record<`${typeof pluginName}/${keyof typeof rules}`, "error">,
  plugins: { [pluginName]: { rules } },
};
