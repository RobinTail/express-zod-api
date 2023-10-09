/**
 * This file is based on https://github.com/sachinraja/zod-to-ts
 *
 * MIT License
 *
 * Copyright (c) 2021 Sachin Raja
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import ts from "typescript";
import { z } from "zod";
import { FlatObject } from "./common-helpers";
import { SchemaHandler } from "./schema-walker";

const { factory: f } = ts;

export type LiteralType = string | number | boolean;

export interface ZTSContext extends FlatObject {
  isResponse: boolean;
  getAlias: (name: string) => ts.TypeReferenceNode | undefined;
  makeAlias: (name: string, type: ts.TypeNode) => ts.TypeReferenceNode;
  serializer: (schema: z.ZodTypeAny) => string;
  optionalPropStyle: { withQuestionMark?: boolean; withUndefined?: boolean };
}

export type Producer<T extends z.ZodTypeAny> = SchemaHandler<
  T,
  ts.TypeNode,
  ZTSContext
>;

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
