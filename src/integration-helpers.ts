import ts from "typescript";

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

const emptyPrefix = f.createTemplateHead("");

const emptyEnding = f.createTemplateTail("");

const spacingSuffix = f.createTemplateMiddle(" ");

export const makeTemplate = (names: (ts.Identifier | string)[]) =>
  f.createTemplateLiteralType(
    emptyPrefix,
    names.map((name, index) =>
      f.createTemplateLiteralTypeSpan(
        f.createTypeReferenceNode(name),
        index === names.length - 1 ? emptyEnding : spacingSuffix,
      ),
    ),
  );

export const parametricIndexNode = makeTemplate(["M", "P"]);

export const makeParam = (
  name: string,
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
  Object.keys(params).reduce(
    (acc, name) => acc.concat(makeParam(name, params[name], mod)),
    [] as ts.ParameterDeclaration[],
  );

export const makeRecord = (
  key: ts.Identifier | ts.KeywordTypeSyntaxKind,
  value: ts.KeywordTypeSyntaxKind,
) =>
  f.createExpressionWithTypeArguments(f.createIdentifier("Record"), [
    typeof key === "number"
      ? f.createKeywordTypeNode(key)
      : f.createTypeReferenceNode(key),
    f.createKeywordTypeNode(value),
  ]);

export const makeEmptyInitializingConstructor = (
  params: ts.ParameterDeclaration[],
) => f.createConstructorDeclaration(undefined, params, f.createBlock([]));

export const makeQuotedProp = (name: string, ref: string) =>
  f.createPropertySignature(
    undefined,
    `"${name}"`,
    undefined,
    f.createTypeReferenceNode(ref),
  );

export const makeConst = (name: string, value: ts.Expression) =>
  f.createVariableDeclarationList(
    [f.createVariableDeclaration(name, undefined, undefined, value)],
    ts.NodeFlags.Const,
  );

export const makePublicLiteralType = (name: string, literals: string[]) =>
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

export const makePublicType = (name: string, value: ts.TypeNode) =>
  f.createTypeAliasDeclaration(exportModifier, name, undefined, value);

export const makePublicReadonlyProp = (
  name: string,
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
  name: string,
  constructor: ts.ConstructorDeclaration,
  props: ts.PropertyDeclaration[] = [],
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

export const makePublicExtendedInterface = (
  name: string,
  extender: ts.HeritageClause[],
  props: ts.PropertySignature[],
) =>
  f.createInterfaceDeclaration(
    exportModifier,
    name,
    undefined,
    extender,
    props,
  );

export const makeTypeParams = (params: Record<string, ts.Identifier>) =>
  Object.keys(params).reduce(
    (acc, name) =>
      acc.concat(
        f.createTypeParameterDeclaration(
          [],
          name,
          f.createTypeReferenceNode(params[name]),
        ),
      ),
    [] as ts.TypeParameterDeclaration[],
  );

export const makeImplementationCallFn = (
  params: string[],
  args: ts.Expression[],
) =>
  f.createArrowFunction(
    asyncModifier,
    undefined,
    params.map((key) => makeParam(key)),
    undefined,
    undefined,
    f.createCallExpression(
      f.createPropertyAccessExpression(f.createThis(), "implementation"),
      undefined,
      args,
    ),
  );

export const makeObjectKeysReducer = (
  obj: string,
  exp: ts.Expression,
  initial: ts.Expression,
) =>
  f.createCallExpression(
    f.createPropertyAccessExpression(
      f.createCallExpression(
        f.createPropertyAccessExpression(f.createIdentifier("Object"), "keys"),
        undefined,
        [f.createIdentifier(obj)],
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
