/* oxlint-disable allowed/dependencies -- experiment ⚠️*/
import * as R from "ramda";
import * as f from "@typescript/native/unstable/ast/factory";
import {
  SyntaxKind,
  TokenFlags,
  NodeFlags,
  type TypeNode,
  type Node,
  type Identifier,
  type KeywordTypeSyntaxKind,
  type KeywordTypeNode,
  type BooleanLiteral,
  type NumericLiteral,
  type StringLiteral,
  type BigIntLiteral,
  type NullLiteral,
  type TypeElement,
  type TemplateLiteralTypeSpan,
  type PropertySignatureDeclaration,
  type ComputedPropertyName,
} from "@typescript/native/unstable/ast";
import {
  isIdentifier,
  isTypeLiteralNode,
} from "@typescript/native/unstable/ast/is";
import { API, type PrintNodeOptions } from "@typescript/native/unstable/sync";

export {
  f,
  isIdentifier,
  isTypeLiteralNode,
  SyntaxKind,
  TokenFlags,
  NodeFlags,
  type TypeNode,
  type PrintNodeOptions,
  type KeywordTypeSyntaxKind,
  type TypeElement,
  type TemplateLiteralTypeSpan,
  type PropertySignatureDeclaration,
  type ComputedPropertyName,
};

const safePropRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const primitives = new Set<SyntaxKind>([
  SyntaxKind.AnyKeyword,
  SyntaxKind.BigIntKeyword,
  SyntaxKind.BooleanKeyword,
  SyntaxKind.NeverKeyword,
  SyntaxKind.NumberKeyword,
  SyntaxKind.ObjectKeyword,
  SyntaxKind.StringKeyword,
  SyntaxKind.SymbolKeyword,
  SyntaxKind.UndefinedKeyword,
  SyntaxKind.UnknownKeyword,
  SyntaxKind.VoidKeyword,
] satisfies KeywordTypeSyntaxKind[]);

export type Typeable = TypeNode | Identifier | string | KeywordTypeSyntaxKind;
export type DeferredCode = (opts?: PrintNodeOptions) => string;

// oxfmt-ignore
export const literally = <T extends string | null | boolean | number | bigint>(
  subj: T,
) => (
  typeof subj === "number" ? f.createNumericLiteral(subj.toString(), TokenFlags.None)
  : typeof subj === "bigint" ? f.createBigIntLiteral(subj.toString(), TokenFlags.None)
  : typeof subj === "boolean" ? subj
    ? f.createKeywordExpression(SyntaxKind.TrueKeyword)
    : f.createKeywordExpression(SyntaxKind.FalseKeyword)
  : subj === null ? f.createKeywordExpression(SyntaxKind.NullKeyword)
  : f.createStringLiteral(subj, TokenFlags.None)
) as T extends string ? StringLiteral : T extends number ? NumericLiteral
  : T extends boolean ? BooleanLiteral : T extends bigint ? BigIntLiteral : NullLiteral;

export const makeId = (name: string) => f.createIdentifier(name);

export const makePropertyIdentifier = (name: string | number) =>
  typeof name === "string" && safePropRegex.test(name)
    ? makeId(name)
    : literally(name);

export const ensureTypeNode = (
  subject: Typeable,
  args?: Typeable[], // only for string and id
): TypeNode =>
  typeof subject === "number"
    ? f.createKeywordTypeNode(subject)
    : typeof subject === "string" || isIdentifier(subject)
      ? f.createTypeReferenceNode(
          typeof subject === "string" ? makeId(subject) : subject,
          args && R.map(ensureTypeNode, args),
        )
      : subject;

/**
 * @internal
 * ensures distinct union (unique primitives)
 * */
export const makeUnion = (entries: TypeNode[]) => {
  const nodes = new Map<TypeNode | KeywordTypeSyntaxKind, TypeNode>();
  for (const entry of entries)
    nodes.set(isPrimitive(entry) ? entry.kind : entry, entry);
  return f.createUnionTypeNode(Array.from(nodes.values()));
};

const isPrimitive = (node: TypeNode): node is KeywordTypeNode =>
  primitives.has(node.kind);

/** @internal this entity exists to enable JSDoc injection due to the missing addSyntheticLeadingComment in tsgo API */
export const customizations = new WeakMap<Node, DeferredCode>();

let emitter: ReturnType<typeof getProject>["emitter"] | undefined;
const getProject = () => {
  const api = new API();
  const snapshot = api.updateSnapshot({ openProjects: ["tsconfig.json"] });
  return snapshot.getProject("tsconfig.json")!;
};

export const printNode = (node: Node, opts?: PrintNodeOptions) =>
  customizations.get(node)?.(opts) ??
  (emitter ??= getProject().emitter).printNode(node, opts);

const reindent = (text: string, offset: number): string =>
  text
    .split("\n")
    .map((line, idx) =>
      idx && line ? line.padStart(line.length + offset) : line,
    )
    .join("\n");

export const makeInterfacePropText = (
  key: string | number,
  typeNode: TypeNode,
  {
    isOptional,
    hasUndefined,
    isDeprecated,
    comment,
  }: {
    isOptional?: boolean;
    hasUndefined?: boolean;
    isDeprecated?: boolean;
    comment?: string;
  } = {},
): DeferredCode => {
  const opt = isOptional ? "?" : "";
  const undef = hasUndefined ? " | undefined" : "";
  const parts = [isDeprecated && "@deprecated", comment].filter(Boolean);
  const jsdoc = parts.length ? `    /** ${parts.join(" ")} */\n` : "";
  return (opts) => {
    const keyText = printNode(makePropertyIdentifier(key), opts);
    const rawTypeText =
      customizations.get(typeNode)?.(opts) ?? printNode(typeNode, opts);
    const typeText = rawTypeText.includes("\n")
      ? reindent(rawTypeText, 4)
      : rawTypeText;
    return `${jsdoc}    ${keyText}${opt}: ${typeText}${undef};`;
  };
};

export const makeInterfaceProp = (
  name: string | number,
  value: Typeable,
  {
    isOptional,
    hasUndefined = isOptional,
  }: {
    isOptional?: boolean;
    hasUndefined?: boolean;
  } = {},
) => {
  const propType = ensureTypeNode(value);
  return f.createPropertySignatureDeclaration(
    undefined,
    makePropertyIdentifier(name),
    isOptional ? f.createToken(SyntaxKind.QuestionToken) : undefined,
    hasUndefined
      ? makeUnion([propType, ensureTypeNode(SyntaxKind.UndefinedKeyword)])
      : propType,
    f.createKeywordExpression(SyntaxKind.NullKeyword), // placeholder initializer, weird tsgo requirement
  );
};

export const makeLiteralType = (subj: Parameters<typeof literally>[0]) =>
  f.createLiteralTypeNode(literally(subj));
