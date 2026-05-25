import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export const getRangeWithComma = (
  ctx: TSESLint.RuleContext<string, unknown[]>,
  node: TSESTree.Node,
): [number, number] => {
  const after = ctx.sourceCode.getTokenAfter(node);
  return after?.value === "," ? [node.range[0], after.range[1]] : node.range;
};

export const hasImport = (
  ctx: TSESLint.RuleContext<string, unknown[]>,
  sourceValue: string,
  importName?: string,
) =>
  ctx.sourceCode.ast.body.some(
    (stmt): stmt is TSESTree.ImportDeclaration =>
      stmt.type === "ImportDeclaration" &&
      stmt.source.value === sourceValue &&
      (importName === undefined ||
        stmt.specifiers.some(
          (spec) =>
            spec.type === "ImportSpecifier" &&
            "name" in spec.imported &&
            spec.imported.name === importName,
        )),
  );

export type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier | TSESTree.StringLiteral;
};

export const queryNamedProp = (name: string) =>
  `Property[key.name="${name}"],Property[key.value="${name}"]`;

export const getPropName = (prop: NamedProp): string =>
  "name" in prop.key ? prop.key.name : prop.key.value;

export const changeProp = ({
  ctx,
  node,
  to,
  assign,
}: {
  ctx: TSESLint.RuleContext<"change", unknown[]>;
  node: NamedProp;
  to: string;
  assign?: (value: typeof node.value) => string | null;
}) =>
  ctx.report({
    node,
    messageId: "change",
    data: { subject: "property", from: getPropName(node), to },
    fix: (fixer) => {
      const changes = [fixer.replaceText(node.key, to)];
      if (assign) {
        const newValue = assign(node.value);
        if (!newValue) return null; // unclear fix
        changes.push(fixer.replaceText(node.value, newValue));
      }
      return changes;
    },
  });
