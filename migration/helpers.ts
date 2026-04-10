import type { TSESLint, TSESTree } from "@typescript-eslint/utils";

export type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier | TSESTree.StringLiteral;
};

export const queryNamedProp = (name: string) =>
  `Property[key.name="${name}"],[key.value="${name}"]`;

export const getPropName = (prop: NamedProp): string =>
  "name" in prop.key ? prop.key.name : prop.key.value;

export const renameProp = ({
  ctx,
  node,
  to,
}: {
  ctx: TSESLint.RuleContext<"change", unknown[]>;
  node: NamedProp;
  to: string;
}) =>
  ctx.report({
    node,
    messageId: "change",
    data: { subject: "property", from: getPropName(node), to },
    fix: (fixer) => fixer.replaceText(node.key, to),
  });
