import ts from "typescript";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { SchemaHandler } from "./schema-walker";

const { factory: f } = ts;

export type LiteralType = string | number | boolean;

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  makeAlias: (
    schema: z.ZodTypeAny,
    produce: () => ts.TypeNode,
  ) => ts.TypeReferenceNode;
  optionalPropStyle: { withQuestionMark?: boolean; withUndefined?: boolean };
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;

export const addJsDocComment = <T extends ts.Node>(node: T, text: string) =>
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

const safePropRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const makePropertyIdentifier = (name: string | number) =>
  typeof name === "number"
    ? f.createNumericLiteral(name)
    : safePropRegex.test(name)
      ? f.createIdentifier(name)
      : f.createStringLiteral(name);

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

export const isPrimitive = (node: ts.TypeNode): node is ts.KeywordTypeNode =>
  (primitives as ts.SyntaxKind[]).includes(node.kind);
