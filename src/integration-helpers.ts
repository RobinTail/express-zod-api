import ts from "typescript";
import { addJsDocComment, makePropertyIdentifier } from "./zts-helpers";

export const f = ts.factory;

export const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];

const asyncModifier = [f.createModifier(ts.SyntaxKind.AsyncKeyword)];

const publicModifier = [f.createModifier(ts.SyntaxKind.PublicKeyword)];

export const protectedReadonlyModifier = [
  f.createModifier(ts.SyntaxKind.ProtectedKeyword),
  f.createModifier(ts.SyntaxKind.ReadonlyKeyword),
];

export const restToken = f.createToken(ts.SyntaxKind.DotDotDotToken);

const emptyHeading = f.createTemplateHead("");
const spacingMiddle = f.createTemplateMiddle(" ");
export const emptyTail = f.createTemplateTail("");

// Record<string, any>
export const recordStringAny = f.createExpressionWithTypeArguments(
  f.createIdentifier("Record"),
  [
    f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
  ],
);

const makeTemplateType = (names: Array<ts.Identifier | string>) =>
  f.createTemplateLiteralType(
    emptyHeading,
    names.map((name, index) =>
      f.createTemplateLiteralTypeSpan(
        f.createTypeReferenceNode(name),
        index === names.length - 1 ? emptyTail : spacingMiddle,
      ),
    ),
  );

export const parametricIndexNode = makeTemplateType(["M", "P"]); // `${M} ${P}`

export const makeParam = (
  name: ts.Identifier,
  type?: ts.TypeNode,
  features?: ts.Modifier[] | ts.DotDotDotToken,
) =>
  f.createParameterDeclaration(
    Array.isArray(features) ? features : undefined,
    Array.isArray(features) ? undefined : features,
    name,
    undefined,
    type,
    undefined,
  );

export const makeParams = (
  params: Record<string, ts.TypeNode | undefined>,
  features?: ts.Modifier[] | ts.DotDotDotToken,
) =>
  Object.entries(params).map(([name, node]) =>
    makeParam(f.createIdentifier(name), node, features),
  );

export const makeEmptyInitializingConstructor = (
  params: ts.ParameterDeclaration[],
) => f.createConstructorDeclaration(undefined, params, f.createBlock([]));

export const makeInterfaceProp = (name: string | number, value: ts.TypeNode) =>
  f.createPropertySignature(
    undefined,
    makePropertyIdentifier(name),
    undefined,
    value,
  );

export const makeDeconstruction = (
  ...names: ts.Identifier[]
): ts.ArrayBindingPattern =>
  f.createArrayBindingPattern(
    names.map(
      (name) => f.createBindingElement(undefined, undefined, name), // can also add default value at last
    ),
  );

export const makeConst = (
  name: ts.Identifier | ts.ArrayBindingPattern,
  value: ts.Expression,
  type?: ts.TypeNode,
) =>
  f.createVariableDeclarationList(
    [f.createVariableDeclaration(name, undefined, type, value)],
    ts.NodeFlags.Const,
  );

export const makePublicLiteralType = (
  name: ts.Identifier | string,
  literals: string[],
) =>
  makeType(
    name,
    f.createUnionTypeNode(
      literals.map((option) =>
        f.createLiteralTypeNode(f.createStringLiteral(option)),
      ),
    ),
    { isPublic: true },
  );

export const makeType = (
  name: ts.Identifier | string,
  value: ts.TypeNode,
  {
    isPublic,
    comment,
    params,
  }: {
    isPublic?: boolean;
    comment?: string;
    params?: Parameters<typeof makeTypeParams>[0];
  } = {},
) => {
  const node = f.createTypeAliasDeclaration(
    isPublic ? exportModifier : undefined,
    name,
    params && makeTypeParams(params),
    value,
  );
  return comment ? addJsDocComment(node, comment) : node;
};

/** @example type SomeOf<T> = T[keyof T]; */
export const makeSomeOfHelper = () =>
  makeType(
    "SomeOf",
    f.createIndexedAccessTypeNode(
      f.createTypeReferenceNode("T"),
      makeKeyOf("T"),
    ),
    { params: { T: undefined } },
  );

export const makePublicMethod = (
  name: ts.Identifier,
  params: ts.ParameterDeclaration[],
  body?: ts.Block,
  typeParams?: ts.TypeParameterDeclaration[],
  returnType?: ts.TypeNode,
) =>
  f.createMethodDeclaration(
    publicModifier,
    undefined,
    name,
    undefined,
    typeParams,
    params,
    returnType,
    body,
  );

export const makePublicClass = (
  name: ts.Identifier,
  constructor: ts.ConstructorDeclaration,
  statements: ts.MethodDeclaration[],
) =>
  f.createClassDeclaration(exportModifier, name, undefined, undefined, [
    constructor,
    ...statements,
  ]);

export const makeKeyOf = (id: ts.Identifier | string) =>
  f.createTypeOperatorNode(
    ts.SyntaxKind.KeyOfKeyword,
    f.createTypeReferenceNode(id),
  );

export const makeConditionalIndex = (
  subject: ts.Identifier,
  key: ts.TypeNode,
  fallback: ts.TypeNode,
) =>
  f.createConditionalTypeNode(
    key,
    makeKeyOf(subject),
    f.createIndexedAccessTypeNode(f.createTypeReferenceNode(subject), key),
    fallback,
  );

export const makePromise = (subject: ts.TypeNode | "any") =>
  f.createTypeReferenceNode(Promise.name, [
    subject === "any"
      ? f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
      : subject,
  ]);

export const makeInterface = (
  name: ts.Identifier | string,
  props: ts.PropertySignature[],
  { isPublic, comment }: { isPublic?: boolean; comment?: string } = {},
) => {
  const node = f.createInterfaceDeclaration(
    isPublic ? exportModifier : undefined,
    name,
    undefined,
    undefined,
    props,
  );
  return comment ? addJsDocComment(node, comment) : node;
};

export const makeTypeParams = (
  params: Partial<Record<string, ts.Identifier>>,
) =>
  Object.entries(params).map(([name, id]) =>
    f.createTypeParameterDeclaration(
      [],
      name,
      id && f.createTypeReferenceNode(id),
    ),
  );

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
        f.createPropertyAccessExpression(
          f.createIdentifier(Object.name),
          propOf<typeof Object>("keys"),
        ),
        undefined,
        [obj],
      ),
      propOf<string[]>("reduce"),
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

export const propOf = <T>(name: keyof NoInfer<T>) => name as string;

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

export const makePropCall = (
  parent: ts.Expression | [ts.Expression, ts.Identifier],
  child: ts.Identifier | string,
  args?: ts.Expression[],
) =>
  f.createCallExpression(
    f.createPropertyAccessExpression(
      Array.isArray(parent)
        ? f.createPropertyAccessExpression(...parent)
        : parent,
      child,
    ),
    undefined,
    args,
  );

export const makeAnd = (left: ts.Expression, right: ts.Expression) =>
  f.createBinaryExpression(
    left,
    f.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
    right,
  );

export const makeEqual = (left: ts.Expression, right: ts.Expression) =>
  f.createBinaryExpression(
    left,
    f.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
    right,
  );
