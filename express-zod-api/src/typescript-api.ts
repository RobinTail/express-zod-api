import * as R from "ramda";
import ts from "typescript"; // eslint-disable-line allowed/dependencies -- opt-in export

export { ts };

export const f = ts.factory;

export const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];

const safePropRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const primitives: ts.KeywordTypeSyntaxKind[] = [
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
];

export type Typeable =
  ts.TypeNode | ts.Identifier | string | ts.KeywordTypeSyntaxKind;

export const propOf = <T>(name: keyof NoInfer<T>) => name as string;

/* eslint-disable prettier/prettier -- shorter and works better this way than overrides */
export const literally = <T extends string | null | boolean | number | bigint>(subj: T) => (
  typeof subj === "number" ? f.createNumericLiteral(subj)
    : typeof subj === "bigint" ? f.createBigIntLiteral(subj.toString())
      : typeof subj === "boolean" ? subj ? f.createTrue() : f.createFalse()
        : subj === null ? f.createNull() : f.createStringLiteral(subj)
) as T extends string ? ts.StringLiteral : T extends number ? ts.NumericLiteral
  : T extends boolean ? ts.BooleanLiteral : T extends bigint ? ts.BigIntLiteral : ts.NullLiteral;
/* eslint-enable prettier/prettier */

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
      ? f.createTypeReferenceNode(subject, args && R.map(ensureTypeNode, args))
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
  (primitives as ts.SyntaxKind[]).includes(node.kind);

const addJsDoc = <T extends ts.Node>(node: T, text: string) =>
  ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `* ${text} `,
    true,
  );

export const printNode = (
  node: ts.Node,
  printerOptions?: ts.PrinterOptions,
) => {
  const sourceFile = ts.createSourceFile(
    "print.ts",
    "",
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS,
  );
  const printer = ts.createPrinter(printerOptions);
  return printer.printNode(ts.EmitHint.Unspecified, node, sourceFile);
};

export const makeInterfaceProp = (
  name: string | number,
  value: Typeable,
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
) => {
  const propType = ensureTypeNode(value);
  const node = f.createPropertySignature(
    undefined,
    makePropertyIdentifier(name),
    isOptional ? f.createToken(ts.SyntaxKind.QuestionToken) : undefined,
    hasUndefined
      ? makeUnion([propType, ensureTypeNode(ts.SyntaxKind.UndefinedKeyword)])
      : propType,
  );
  const jsdoc = R.reject(R.isNil, [
    isDeprecated ? "@deprecated" : undefined,
    comment,
  ]);
  return jsdoc.length ? addJsDoc(node, jsdoc.join(" ")) : node;
};

export const makeLiteralType = (subj: Parameters<typeof literally>[0]) =>
  f.createLiteralTypeNode(literally(subj));
