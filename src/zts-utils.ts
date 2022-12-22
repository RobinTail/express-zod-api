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

import {
  EmitHint,
  Identifier,
  Node,
  PrinterOptions,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  TypeNode,
  TypeReferenceNode,
  addSyntheticLeadingComment,
  createPrinter,
  createSourceFile,
  factory as f,
  isIdentifier,
} from "typescript";
import { ZodTypeAny } from "zod";
import { GetType, GetTypeFn } from "./zts-types";

export const ensureTypeNode = (
  subject: Identifier | TypeNode
): TypeNode | TypeReferenceNode => {
  if (isIdentifier(subject)) {
    return f.createTypeReferenceNode(subject);
  }
  return subject;
};

export const makeTypeReference = (name: string) =>
  f.createTypeReferenceNode(f.createIdentifier(name));

export const createUnknownKeywordNode = () =>
  f.createKeywordTypeNode(SyntaxKind.UnknownKeyword);

export const addJsDocComment = (node: Node, text: string) => {
  addSyntheticLeadingComment(
    node,
    SyntaxKind.MultiLineCommentTrivia,
    `* ${text} `,
    true
  );
};

export const createTypeAlias = (
  node: TypeNode,
  identifier: string,
  comment?: string
) => {
  const typeAlias = f.createTypeAliasDeclaration(
    undefined,
    f.createIdentifier(identifier),
    undefined,
    node
  );
  if (comment) {
    addJsDocComment(typeAlias, comment);
  }
  return typeAlias;
};

export const printNode = (node: Node, printerOptions?: PrinterOptions) => {
  const sourceFile = createSourceFile(
    "print.ts",
    "",
    ScriptTarget.Latest,
    false,
    ScriptKind.TS
  );
  const printer = createPrinter(printerOptions);
  return printer.printNode(EmitHint.Unspecified, node, sourceFile);
};

export const withGetType = <T extends ZodTypeAny & GetType>(
  schema: T,
  getType: GetTypeFn
): T => {
  schema.getType = getType;
  return schema;
};

const identifierRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

export const makePropertyIdentifier = (name: string) => {
  if (identifierRegex.test(name)) {
    return f.createIdentifier(name);
  }
  return f.createStringLiteral(name);
};
