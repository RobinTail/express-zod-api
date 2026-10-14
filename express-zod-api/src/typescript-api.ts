import * as R from "ramda";
import ts from "typescript"; // oxlint-disable-line allowed/dependencies -- opt-in export

export { ts };

export const f = ts.factory;

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

// oxfmt-ignore
export const literally = <T extends string | null | boolean | number | bigint>(subj: T) => (
  typeof subj === "number" ? f.createNumericLiteral(subj)
    : typeof subj === "bigint" ? f.createBigIntLiteral(subj.toString())
      : typeof subj === "boolean" ? subj ? f.createTrue() : f.createFalse()
        : subj === null ? f.createNull() : f.createStringLiteral(subj)
) as T extends string ? ts.StringLiteral : T extends number ? ts.NumericLiteral
  : T extends boolean ? ts.BooleanLiteral : T extends bigint ? ts.BigIntLiteral : ts.NullLiteral;

export const makeId = (name: string) => f.createIdentifier(name);

/** @desc Checks the name to be a valid identifier that is not a keyword (such as "string" or "type") */
export const isValidTypeName = (name: string) =>
  safePropRegex.test(name) &&
  ts.identifierToKeywordKind(makeId(name)) === undefined;

export const makePropertyIdentifier = (name: string | number) =>
  typeof name === "string" && safePropRegex.test(name)
    ? makeId(name)
    : literally(name);

/** @desc Replaces the type references by name, returning undefined from the replacer keeps the reference */
export const replaceRefs = (
  node: ts.TypeNode,
  replacer: (name: string) => string | undefined,
) =>
  ts.transform(node, [
    (ctx) => (root) => {
      const visit = (subject: ts.Node): ts.Node => {
        const name =
          ts.isTypeReferenceNode(subject) && ts.isIdentifier(subject.typeName)
            ? replacer(subject.typeName.text)
            : undefined;
        return name
          ? ensureTypeNode(name)
          : ts.visitEachChild(subject, visit, ctx);
      };
      return ts.visitNode(root, visit) as ts.TypeNode;
    },
  ]).transformed[0]!; // single node given

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
  primitives.has(node.kind);

const addJsDoc = <T extends ts.Node>(node: T, text: string) =>
  ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `* ${text} `,
    true,
  );

export const printNode = (
  node: ts.TypeNode,
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
