import type { TSESTree } from "@typescript-eslint/utils";

export type NamedProp = TSESTree.PropertyNonComputedName & {
  key: TSESTree.Identifier | TSESTree.StringLiteral;
};

export const queryNamedProp = (name: string) =>
  `Property[key.name="${name}"],[key.value="${name}"]`;

export const getPropName = (prop: NamedProp): string =>
  "name" in prop.key ? prop.key.name : prop.key.value;
