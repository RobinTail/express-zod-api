import ts from "typescript";
import { Method } from "./method";

export const f = ts.factory;

const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];

const asyncModifier = [f.createModifier(ts.SyntaxKind.AsyncKeyword)];

const publicModifier = [f.createModifier(ts.SyntaxKind.PublicKeyword)];

export const protectedReadonlyModifier = [
  f.createModifier(ts.SyntaxKind.ProtectedKeyword),
  f.createModifier(ts.SyntaxKind.ReadonlyKeyword),
];

export const makeTemplate = (
  head: string,
  ...rest: ([ts.Expression] | [ts.Expression, string])[]
) =>
  f.createTemplateExpression(
    f.createTemplateHead(head),
    rest.map(([id, str = ""], idx) =>
      f.createTemplateSpan(
        id,
        idx === rest.length - 1
          ? f.createTemplateTail(str)
          : f.createTemplateMiddle(str),
      ),
    ),
  );

// Record<string, any>
export const recordStringAny = f.createExpressionWithTypeArguments(
  f.createIdentifier("Record"),
  [
    f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
    f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
  ],
);

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
  Object.entries(params).map(([name, node]) =>
    makeParam(f.createIdentifier(name), node, mod),
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
  { type, expose }: { type?: ts.TypeNode; expose?: true } = {},
) =>
  f.createVariableStatement(
    expose && exportModifier,
    f.createVariableDeclarationList(
      [f.createVariableDeclaration(name, undefined, type, value)],
      ts.NodeFlags.Const,
    ),
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

export const makeKeyOf = (id: ts.Identifier) =>
  f.createTypeOperatorNode(
    ts.SyntaxKind.KeyOfKeyword,
    f.createTypeReferenceNode(id),
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

export const makeTypeParams = (params: Record<string, ts.Identifier>) =>
  Object.entries(params).map(([name, id]) =>
    f.createTypeParameterDeclaration([], name, f.createTypeReferenceNode(id)),
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

export const makeAnd = (left: ts.Expression, right: ts.Expression) =>
  f.createBinaryExpression(
    left,
    f.createToken(ts.SyntaxKind.AmpersandAmpersandToken),
    right,
  );

export const makeNew = (cls: ts.Identifier, ...args: ts.Expression[]) =>
  f.createNewExpression(cls, undefined, args);
