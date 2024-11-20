import ts from "typescript";
import { chain } from "ramda";
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

const emptyHeading = f.createTemplateHead("");
const spacingMiddle = f.createTemplateMiddle(" ");
export const emptyTail = f.createTemplateTail("");

export const makeTemplateType = (names: Array<ts.Identifier | string>) =>
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
) =>
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
) =>
  chain(
    ([name, node]) => [makeParam(f.createIdentifier(name), node, mod)],
    Object.entries(params),
  );

export const makeRecord = (
  key: ts.KeywordTypeSyntaxKind,
  value: ts.KeywordTypeSyntaxKind,
) =>
  f.createExpressionWithTypeArguments(f.createIdentifier("Record"), [
    f.createKeywordTypeNode(key),
    f.createKeywordTypeNode(value),
  ]);

export const makeEmptyInitializingConstructor = (
  params: ts.ParameterDeclaration[],
) => f.createConstructorDeclaration(undefined, params, f.createBlock([]));

export const makeInterfaceProp = (name: string, ref: string) =>
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
) =>
  f.createVariableDeclarationList(
    [f.createVariableDeclaration(name, undefined, type, value)],
    ts.NodeFlags.Const,
  );

export const makePublicLiteralType = (
  name: ts.Identifier,
  literals: string[],
) =>
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

export const makePublicType = (name: ts.Identifier, value: ts.TypeNode) =>
  f.createTypeAliasDeclaration(exportModifier, name, undefined, value);

export const makePublicReadonlyProp = (
  name: ts.Identifier,
  type: ts.TypeNode,
  exp: ts.Expression,
) =>
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
) =>
  f.createClassDeclaration(exportModifier, name, undefined, undefined, [
    constructor,
    ...props,
  ]);

export const makeIndexedPromise = (type: ts.Identifier, index: ts.TypeNode) =>
  f.createTypeReferenceNode("Promise", [
    f.createIndexedAccessTypeNode(f.createTypeReferenceNode(type), index),
  ]);

export const makeAnyPromise = () =>
  f.createTypeReferenceNode("Promise", [
    f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
  ]);

export const makePublicInterface = (
  name: ts.Identifier,
  props: ts.PropertySignature[],
) =>
  f.createInterfaceDeclaration(
    exportModifier,
    name,
    undefined,
    undefined,
    props,
  );

const aggregateDeclarations = chain(([name, id]: [string, ts.Identifier]) => [
  f.createTypeParameterDeclaration([], name, f.createTypeReferenceNode(id)),
]);
export const makeTypeParams = (params: Record<string, ts.Identifier>) =>
  aggregateDeclarations(Object.entries(params));

export const makeArrowFn = (
  params: ts.Identifier[],
  body: ts.ConciseBody,
  isAsync?: boolean,
) =>
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
) =>
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

export const quoteProp = (...parts: [Method, string]) => `"${parts.join(" ")}"`;

export const makeTernary = (
  condition: ts.Expression,
  positive: ts.Expression,
  negative: ts.Expression,
) =>
  f.createConditionalExpression(
    condition,
    f.createToken(ts.SyntaxKind.QuestionToken),
    positive,
    f.createToken(ts.SyntaxKind.ColonToken),
    negative,
  );
