import ts from "typescript";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { SchemaHandler } from "./schema-walker";

const { factory: f } = ts;

export type LiteralType = string | number | boolean;

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  hasAdvancedSerialization?: boolean;
  getAlias: (name: string) => ts.TypeReferenceNode | undefined;
  makeAlias: (name: string, type: ts.TypeNode) => ts.TypeReferenceNode;
  serializer: (schema: z.ZodTypeAny) => string;
  optionalPropStyle: { withQuestionMark?: boolean; withUndefined?: boolean };
}

export type Producer = SchemaHandler<ts.TypeNode, ZTSContext>;

export const addJsDocComment = (node: ts.Node, text: string) => {
  ts.addSyntheticLeadingComment(
    node,
    ts.SyntaxKind.MultiLineCommentTrivia,
    `* ${text} `,
    true,
  );
};

export const createTypeAlias = (
  node: ts.TypeNode,
  identifier: string,
  comment?: string,
) => {
  const typeAlias = f.createTypeAliasDeclaration(
    undefined,
    f.createIdentifier(identifier),
    undefined,
    node,
  );
  if (comment) {
    addJsDocComment(typeAlias, comment);
  }
  return typeAlias;
};

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

export const makePropertyIdentifier = (name: string) => {
  if (safePropRegex.test(name)) {
    return f.createIdentifier(name);
  }
  return f.createStringLiteral(name);
};
