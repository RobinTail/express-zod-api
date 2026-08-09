/* oxlint-disable allowed/dependencies -- experiment ⚠️*/
import * as R from "ramda";
import * as f from "@typescript/native-preview/unstable/ast/factory";
import * as ts from "@typescript/native-preview/unstable/ast";
import {
  API,
  type PrintNodeOptions,
} from "@typescript/native-preview/unstable/sync";

export { f, ts, type PrintNodeOptions };

const safePropRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const primitives = new Set<ts.SyntaxKind>([
  ts.SyntaxKind.AnyKeyword,
  ts.SyntaxKind.BigIntKeyword,
  ts.SyntaxKind.BooleanKeyword,
  ts.SyntaxKind.NeverKeyword,
  ts.SyntaxKind.NumberKeyword,
  ts.SyntaxKind.ObjectKeyword,
  ts.SyntaxKind.StringKeyword,
  ts.SyntaxKind.SymbolKeyword,
  ts.SyntaxKind.UndefinedKeyword,
  ts.SyntaxKind.UnknownKeyword,
  ts.SyntaxKind.VoidKeyword,
] satisfies ts.KeywordTypeSyntaxKind[]);

export type Typeable =
  | ts.TypeNode
  | ts.Identifier
  | string
  | ts.KeywordTypeSyntaxKind;
export type DeferredCode = (opts?: PrintNodeOptions) => string;

// oxfmt-ignore
export const literally = <T extends string | null | boolean | number | bigint>(
  subj: T,
) => (
  typeof subj === "number" ? f.createNumericLiteral(subj.toString(), ts.TokenFlags.None)
  : typeof subj === "bigint" ? f.createBigIntLiteral(subj.toString(), ts.TokenFlags.None)
  : typeof subj === "boolean" ? subj
    ? f.createKeywordExpression(ts.SyntaxKind.TrueKeyword)
    : f.createKeywordExpression(ts.SyntaxKind.FalseKeyword)
  : subj === null ? f.createKeywordExpression(ts.SyntaxKind.NullKeyword)
  : f.createStringLiteral(subj, ts.TokenFlags.None)
) as T extends string ? ts.StringLiteral : T extends number ? ts.NumericLiteral
  : T extends boolean ? ts.BooleanLiteral : T extends bigint ? ts.BigIntLiteral : ts.NullLiteral;

export const makeId = (name: string) => f.createIdentifier(name);

export const makePropertyIdentifier = (name: string | number) =>
  typeof name === "string" && safePropRegex.test(name)
    ? makeId(name)
    : literally(name);

export const ensureTypeNode = (
  subject: Typeable,
  args?: Typeable[], // only for string and id
): ts.TypeNode =>
  typeof subject === "number"
    ? f.createKeywordTypeNode(subject)
    : typeof subject === "string" || ts.isIdentifier(subject)
      ? f.createTypeReferenceNode(
          typeof subject === "string" ? makeId(subject) : subject,
          args && R.map(ensureTypeNode, args),
        )
      : subject;

/**
 * @internal
 * ensures distinct union (unique primitives)
 * */
export const makeUnion = (entries: ts.TypeNode[]) => {
  const nodes = new Map<ts.TypeNode | ts.KeywordTypeSyntaxKind, ts.TypeNode>();
  for (const entry of entries)
    nodes.set(isPrimitive(entry) ? entry.kind : entry, entry);
  return f.createUnionTypeNode(Array.from(nodes.values()));
};

const isPrimitive = (node: ts.TypeNode): node is ts.KeywordTypeNode =>
  primitives.has(node.kind);

/**
 * @internal this entity exists to enable JSDoc injection due to the missing addSyntheticLeadingComment in tsgo API
 * @todo remove if implemented in tsgo API
 * */
export const customizations = new WeakMap<ts.Node, DeferredCode>();

let emitter: ReturnType<typeof getProject>["emitter"] | undefined;
const getProject = () => {
  const api = new API();
  const snapshot = api.updateSnapshot({ openProjects: ["tsconfig.json"] });
  return snapshot.getProject("tsconfig.json")!;
};

export const printNode = (node: ts.Node, opts?: PrintNodeOptions) =>
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
  typeNode: ts.TypeNode,
  {
    isOptional,
    hasUndefined = isOptional,
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
    isOptional ? f.createToken(ts.SyntaxKind.QuestionToken) : undefined,
    hasUndefined
      ? makeUnion([propType, ensureTypeNode(ts.SyntaxKind.UndefinedKeyword)])
      : propType,
    f.createKeywordExpression(ts.SyntaxKind.NullKeyword), // placeholder initializer, weird tsgo requirement
  );
};

export const makeLiteralType = (subj: Parameters<typeof literally>[0]) =>
  f.createLiteralTypeNode(literally(subj));
