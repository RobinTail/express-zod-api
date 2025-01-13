import ts from "typescript";

export const f = ts.factory;

const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];

const asyncModifier = [f.createModifier(ts.SyntaxKind.AsyncKeyword)];

export const accessModifiers = {
  public: [f.createModifier(ts.SyntaxKind.PublicKeyword)],
  protectedReadonly: [
    f.createModifier(ts.SyntaxKind.ProtectedKeyword),
    f.createModifier(ts.SyntaxKind.ReadonlyKeyword),
  ],
};

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
  {
    type,
    mod,
    init,
  }: { type?: ts.TypeNode; mod?: ts.Modifier[]; init?: ts.Expression } = {},
) => f.createParameterDeclaration(mod, undefined, name, undefined, type, init);

export const makeParams = (params: Partial<Record<string, ts.TypeNode>>) =>
  Object.entries(params).map(([name, type]) =>
    makeParam(f.createIdentifier(name), { type }),
  );

export const makeEmptyInitializingConstructor = (
  params: ts.ParameterDeclaration[],
) => f.createConstructorDeclaration(undefined, params, f.createBlock([]));

export const ensureTypeNode = (
  subject: ts.TypeNode | ts.Identifier | string,
): ts.TypeNode =>
  typeof subject === "string" || ts.isIdentifier(subject)
    ? f.createTypeReferenceNode(subject)
    : subject;

export const makeInterfaceProp = (
  name: string | number,
  value: Parameters<typeof ensureTypeNode>[0],
  { isOptional }: { isOptional?: boolean } = {},
) =>
  f.createPropertySignature(
    undefined,
    makePropertyIdentifier(name),
    isOptional ? f.createToken(ts.SyntaxKind.QuestionToken) : undefined,
    ensureTypeNode(value),
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
    { expose: true },
  );

export const makeType = (
  name: ts.Identifier | string,
  value: ts.TypeNode,
  {
    expose,
    comment,
    params,
  }: {
    expose?: boolean;
    comment?: string;
    params?: Parameters<typeof makeTypeParams>[0];
  } = {},
) => {
  const node = f.createTypeAliasDeclaration(
    expose ? exportModifier : undefined,
    name,
    params && makeTypeParams(params),
    value,
  );
  return comment ? addJsDocComment(node, comment) : node;
};

export const makePublicMethod = (
  name: ts.Identifier,
  params: ts.ParameterDeclaration[],
  body: ts.Block,
  {
    typeParams,
    returns,
  }: {
    typeParams?: Parameters<typeof makeTypeParams>[0];
    returns?: ts.TypeNode;
  } = {},
) =>
  f.createMethodDeclaration(
    accessModifiers.public,
    undefined,
    name,
    undefined,
    typeParams && makeTypeParams(typeParams),
    params,
    returns,
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

export const makeKeyOf = (subj: Parameters<typeof ensureTypeNode>[0]) =>
  f.createTypeOperatorNode(ts.SyntaxKind.KeyOfKeyword, ensureTypeNode(subj));

export const makePromise = (subject: ts.TypeNode | "any") =>
  f.createTypeReferenceNode(Promise.name, [
    subject === "any"
      ? f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword)
      : subject,
  ]);

export const makeInterface = (
  name: ts.Identifier | string,
  props: ts.PropertySignature[],
  { expose, comment }: { expose?: boolean; comment?: string } = {},
) => {
  const node = f.createInterfaceDeclaration(
    expose ? exportModifier : undefined,
    name,
    undefined,
    undefined,
    props,
  );
  return comment ? addJsDocComment(node, comment) : node;
};

export const makeTypeParams = (
  params: Partial<Record<string, ts.Identifier | ts.TypeNode>>,
) =>
  Object.entries(params).map(([name, val]) =>
    f.createTypeParameterDeclaration([], name, val && ensureTypeNode(val)),
  );

export const makeArrowFn = (
  params: ts.Identifier[] | Parameters<typeof makeParams>[0],
  body: ts.ConciseBody,
  {
    isAsync,
    typeParams,
  }: {
    isAsync?: boolean;
    typeParams?: Parameters<typeof makeTypeParams>[0];
  } = {},
) =>
  f.createArrowFunction(
    isAsync ? asyncModifier : undefined,
    typeParams && makeTypeParams(typeParams),
    Array.isArray(params)
      ? params.map((key) => makeParam(key))
      : makeParams(params),
    undefined,
    undefined,
    body,
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
  parent: ts.Expression | [ts.Expression, ts.Identifier | string],
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

export const makeEqual = (left: ts.Expression, right: ts.Expression) =>
  f.createBinaryExpression(
    left,
    f.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
    right,
  );

export const makeNew = (cls: ts.Identifier, ...args: ts.Expression[]) =>
  f.createNewExpression(cls, undefined, args);

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
