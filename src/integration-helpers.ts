import ts from "typescript";
import { chain } from "ramda";
import { Method } from "./method";

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
  chain(
    ([name, node]) => [makeParam(f.createIdentifier(name), node, features)],
    Object.entries(params),
  );

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
  name: ts.Identifier,
  literals: string[],
) =>
  makePublicType(
    name,
    f.createUnionTypeNode(
      literals.map((option) =>
        f.createLiteralTypeNode(f.createStringLiteral(option)),
      ),
    ),
  );

export const makePublicType = (name: ts.Identifier, value: ts.TypeNode) =>
  f.createTypeAliasDeclaration(exportModifier, name, undefined, value);

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

export const makeConditionalIndex = (
  subject: ts.Identifier,
  key: ts.TypeNode,
  fallback: ts.TypeNode,
) =>
  f.createConditionalTypeNode(
    key,
    f.createTypeOperatorNode(
      ts.SyntaxKind.KeyOfKeyword,
      f.createTypeReferenceNode(subject),
    ),
    f.createIndexedAccessTypeNode(f.createTypeReferenceNode(subject), key),
    fallback,
  );

export const makePromise = (subject: ts.TypeNode | "any") =>
  f.createTypeReferenceNode(Promise.name, [
    subject === "any"
      ? f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
      : subject,
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

export const quoteProp = (...parts: [Method, string]) => `"${parts.join(" ")}"`;
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
