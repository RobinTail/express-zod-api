import ts from "typescript";
import { chain, toPairs } from "ramda";
import { Method } from "./method";

export const f = ts.factory;

export const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];

const asyncModifier = [f.createModifier(ts.SyntaxKind.AsyncKeyword)];

const publicReadonlyModifier = [
  f.createModifier(ts.SyntaxKind.PublicKeyword),
  f.createModifier(ts.SyntaxKind.ReadonlyKeyword),
];

export const protectedReadonlyModifier = [
  f.createModifier(ts.SyntaxKind.ProtectedKeyword),
  f.createModifier(ts.SyntaxKind.ReadonlyKeyword),
];

export const emptyHeading = f.createTemplateHead("");

export const emptyTail = f.createTemplateTail("");

export const spacingMiddle = f.createTemplateMiddle(" ");

export const makeTemplateType = (
  names: Array<ts.Identifier | string>,
): ts.TemplateLiteralTypeNode =>
  f.createTemplateLiteralType(
    emptyHeading,
    names.map((name, index) =>
      f.createTemplateLiteralTypeSpan(
        f.createTypeReferenceNode(name),
        index === names.length - 1 ? emptyTail : spacingMiddle,
      ),
    ),
  );

export const parametricIndexNode = makeTemplateType(["M", "P"]);

export const makeParam = (
  name: ts.Identifier,
  type?: ts.TypeNode,
  mod?: ts.Modifier[],
): ts.ParameterDeclaration =>
  f.createParameterDeclaration(
    mod,
    undefined,
    name,
    undefined,
    type,
    undefined,
  );

export const makeParams = (
  params: Record<string, ts.TypeNode | undefined>,
  mod?: ts.Modifier[],
): ts.ParameterDeclaration[] =>
  chain(
    ([name, node]) => [makeParam(f.createIdentifier(name), node, mod)],
    toPairs(params),
  );

export const makeRecord = (
  key: ts.Identifier | ts.KeywordTypeSyntaxKind,
  value: ts.KeywordTypeSyntaxKind,
): ts.ExpressionWithTypeArguments =>
  f.createExpressionWithTypeArguments(f.createIdentifier("Record"), [
    typeof key === "number"
      ? f.createKeywordTypeNode(key)
      : f.createTypeReferenceNode(key),
    f.createKeywordTypeNode(value),
  ]);

export const makeEmptyInitializingConstructor = (
  params: ts.ParameterDeclaration[],
): ts.ConstructorDeclaration =>
  f.createConstructorDeclaration(undefined, params, f.createBlock([]));

export const makeInterfaceProp = (
  name: string,
  ref: string,
): ts.PropertySignature =>
  f.createPropertySignature(
    undefined,
    name,
    undefined,
    f.createTypeReferenceNode(ref),
  );

export const makeConst = (
  name: ts.Identifier,
  value: ts.Expression,
  type?: ts.TypeNode,
): ts.VariableDeclarationList =>
  f.createVariableDeclarationList(
    [f.createVariableDeclaration(name, undefined, type, value)],
    ts.NodeFlags.Const,
  );

export const makePublicLiteralType = (
  name: ts.Identifier,
  literals: string[],
): ts.TypeAliasDeclaration =>
  f.createTypeAliasDeclaration(
    exportModifier,
    name,
    undefined,
    f.createUnionTypeNode(
      literals.map((option) =>
        f.createLiteralTypeNode(f.createStringLiteral(option)),
      ),
    ),
  );

export const makePublicType = (
  name: ts.Identifier,
  value: ts.TypeNode,
): ts.TypeAliasDeclaration =>
  f.createTypeAliasDeclaration(exportModifier, name, undefined, value);

export const makePublicReadonlyProp = (
  name: ts.Identifier,
  type: ts.TypeNode,
  exp: ts.Expression,
): ts.PropertyDeclaration =>
  f.createPropertyDeclaration(
    publicReadonlyModifier,
    name,
    undefined,
    type,
    exp,
  );

export const makePublicClass = (
  name: ts.Identifier,
  constructor: ts.ConstructorDeclaration,
  props: ts.PropertyDeclaration[],
): ts.ClassDeclaration =>
  f.createClassDeclaration(exportModifier, name, undefined, undefined, [
    constructor,
    ...props,
  ]);

export const makeIndexedPromise = (
  type: ts.Identifier,
  index: ts.TypeNode,
): ts.TypeReferenceNode =>
  f.createTypeReferenceNode("Promise", [
    f.createIndexedAccessTypeNode(f.createTypeReferenceNode(type), index),
  ]);

export const makeAnyPromise = (): ts.TypeReferenceNode =>
  f.createTypeReferenceNode("Promise", [
    f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
  ]);

export const makePublicExtendedInterface = (
  name: ts.Identifier,
  extender: ts.HeritageClause[],
  props: ts.PropertySignature[],
): ts.InterfaceDeclaration =>
  f.createInterfaceDeclaration(
    exportModifier,
    name,
    undefined,
    extender,
    props,
  );

const aggregateDeclarations = chain(([name, id]: [string, ts.Identifier]) => [
  f.createTypeParameterDeclaration([], name, f.createTypeReferenceNode(id)),
]);
export const makeTypeParams = (
  params: Record<string, ts.Identifier>,
): ts.TypeParameterDeclaration[] => aggregateDeclarations(toPairs(params));

export const makeArrowFn = (
  params: ts.Identifier[],
  body: ts.ConciseBody,
  isAsync?: boolean,
): ts.ArrowFunction =>
  f.createArrowFunction(
    isAsync ? asyncModifier : undefined,
    undefined,
    params.map((key) => makeParam(key)),
    undefined,
    undefined,
    body,
  );

export const makeObjectKeysReducer = (
  obj: ts.Identifier,
  exp: ts.Expression,
  initial: ts.Expression,
): ts.CallExpression =>
  f.createCallExpression(
    f.createPropertyAccessExpression(
      f.createCallExpression(
        f.createPropertyAccessExpression(f.createIdentifier("Object"), "keys"),
        undefined,
        [obj],
      ),
      "reduce",
    ),
    undefined,
    [
      f.createArrowFunction(
        undefined,
        undefined,
        makeParams({ acc: undefined, key: undefined }),
        undefined,
        undefined,
        exp,
      ),
      initial,
    ],
  );

export const quoteProp = (...parts: [Method, string]): string =>
  `"${parts.join(" ")}"`;
