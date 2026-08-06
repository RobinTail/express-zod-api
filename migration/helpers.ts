import type { ESTree, Context } from "@oxlint/plugins";

export type NamedProp = ESTree.ObjectProperty & {
  key: ESTree.IdentifierName | ESTree.StringLiteral;
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
  ctx: Context;
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

export const removeProp = ({ ctx, node }: { ctx: Context; node: NamedProp }) =>
  ctx.report({
    node,
    messageId: "remove",
    data: { subject: `${getPropName(node)} property` },
    fix: (fixer) => {
      const next = ctx.sourceCode.getTokenAfter(node);
      return fixer.removeRange([
        node.range[0],
        next?.value === "," ? next.range[1] : node.range[1],
      ]);
    },
  });
