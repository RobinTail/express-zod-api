import { map, pair } from "ramda";
import ts from "typescript";

export type Typeable =
  | ts.TypeNode
  | ts.Identifier
  | string
  | ts.KeywordTypeSyntaxKind;

type TypeParams =
  | string[]
  | Partial<Record<string, Typeable | { type?: ts.TypeNode; init: Typeable }>>;

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
  typeof name === "string" && safePropRegex.test(name)
    ? f.createIdentifier(name)
    : literally(name);

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

export const makeParam = (
  name: string | ts.Identifier,
  {
    type,
    mod,
    init,
    optional,
  }: {
    type?: Typeable;
    mod?: ts.Modifier[];
    init?: ts.Expression;
    optional?: boolean;
  } = {},
) =>
  f.createParameterDeclaration(
    mod,
    undefined,
    name,
    optional ? f.createToken(ts.SyntaxKind.QuestionToken) : undefined,
    type ? ensureTypeNode(type) : undefined,
    init,
  );

export const makeParams = (
  params: Partial<Record<string, Typeable | Parameters<typeof makeParam>[1]>>,
) =>
  Object.entries(params).map(([name, value]) =>
    makeParam(
      name,
      typeof value === "string" ||
        typeof value === "number" ||
        (typeof value === "object" && "kind" in value)
        ? { type: value }
        : value,
    ),
  );

export const makePublicConstructor = (
  params: ts.ParameterDeclaration[],
  statements: ts.Statement[] = [],
) =>
  f.createConstructorDeclaration(
    accessModifiers.public,
    params,
    f.createBlock(statements),
  );

export const ensureTypeNode = (
  subject: Typeable,
  args?: Typeable[], // only for string and id
): ts.TypeNode =>
  typeof subject === "number"
    ? f.createKeywordTypeNode(subject)
    : typeof subject === "string" || ts.isIdentifier(subject)
      ? f.createTypeReferenceNode(subject, args && map(ensureTypeNode, args))
      : subject;

// Record<string, any>
export const recordStringAny = ensureTypeNode("Record", [
  ts.SyntaxKind.StringKeyword,
  ts.SyntaxKind.AnyKeyword,
]);

export const makeInterfaceProp = (
  name: string | number,
  value: Typeable,
  { isOptional, comment }: { isOptional?: boolean; comment?: string } = {},
) => {
  const node = f.createPropertySignature(
    undefined,
    makePropertyIdentifier(name),
    isOptional ? f.createToken(ts.SyntaxKind.QuestionToken) : undefined,
    ensureTypeNode(value),
  );
  return comment ? addJsDocComment(node, comment) : node;
};

export const makeOneLine = (subject: ts.TypeNode) =>
  ts.setEmitFlags(subject, ts.EmitFlags.SingleLine);

export const makeDeconstruction = (
  ...names: ts.Identifier[]
): ts.ArrayBindingPattern =>
  f.createArrayBindingPattern(
    names.map(
      (name) => f.createBindingElement(undefined, undefined, name), // can also add default value at last
    ),
  );

export const makeConst = (
  name: string | ts.Identifier | ts.ArrayBindingPattern,
  value: ts.Expression,
  { type, expose }: { type?: Typeable; expose?: true } = {},
) =>
  f.createVariableStatement(
    expose && exportModifier,
    f.createVariableDeclarationList(
      [
        f.createVariableDeclaration(
          name,
          undefined,
          type ? ensureTypeNode(type) : undefined,
          value,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );

export const makePublicLiteralType = (
  name: ts.Identifier | string,
  literals: string[],
) =>
  makeType(name, f.createUnionTypeNode(map(makeLiteralType, literals)), {
    expose: true,
  });

export const makeType = (
  name: ts.Identifier | string,
  value: ts.TypeNode,
  {
    expose,
    comment,
    params,
  }: { expose?: boolean; comment?: string; params?: TypeParams } = {},
) => {
  const node = f.createTypeAliasDeclaration(
    expose ? exportModifier : undefined,
    name,
    params && makeTypeParams(params),
    value,
  );
  return comment ? addJsDocComment(node, comment) : node;
};

export const makePublicProperty = (
  name: string | ts.PropertyName,
  type: Typeable,
) =>
  f.createPropertyDeclaration(
    accessModifiers.public,
    name,
    undefined,
    ensureTypeNode(type),
    undefined,
  );

export const makePublicMethod = (
  name: ts.Identifier,
  params: ts.ParameterDeclaration[],
  statements: ts.Statement[],
  {
    typeParams,
    returns,
  }: { typeParams?: TypeParams; returns?: ts.TypeNode } = {},
) =>
  f.createMethodDeclaration(
    accessModifiers.public,
    undefined,
    name,
    undefined,
    typeParams && makeTypeParams(typeParams),
    params,
    returns,
    f.createBlock(statements),
  );

export const makePublicClass = (
  name: string,
  statements: ts.ClassElement[],
  { typeParams }: { typeParams?: TypeParams } = {},
) =>
  f.createClassDeclaration(
    exportModifier,
    name,
    typeParams && makeTypeParams(typeParams),
    undefined,
    statements,
  );

export const makeKeyOf = (subj: Typeable) =>
  f.createTypeOperatorNode(ts.SyntaxKind.KeyOfKeyword, ensureTypeNode(subj));

export const makePromise = (subject: Typeable) =>
  ensureTypeNode(Promise.name, [subject]);

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
  params:
    | string[]
    | Partial<
        Record<string, Typeable | { type?: ts.TypeNode; init: Typeable }>
      >,
) =>
  (Array.isArray(params)
    ? params.map((name) => pair(name, undefined))
    : Object.entries(params)
  ).map(([name, val]) => {
    const { type, init } =
      typeof val === "object" && "init" in val ? val : { type: val };
    return f.createTypeParameterDeclaration(
      [],
      name,
      type ? ensureTypeNode(type) : undefined,
      init ? ensureTypeNode(init) : undefined,
    );
  });

export const makeArrowFn = (
  params:
    | Array<Parameters<typeof makeParam>[0]>
    | Parameters<typeof makeParams>[0],
  body: ts.ConciseBody,
  { isAsync }: { isAsync?: boolean } = {},
) =>
  f.createArrowFunction(
    isAsync ? asyncModifier : undefined,
    undefined,
    Array.isArray(params) ? map(makeParam, params) : makeParams(params),
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

export const makeCall =
  (
    first: ts.Expression,
    ...rest: Array<ts.Identifier | ts.ConditionalExpression | string>
  ) =>
  (...args: ts.Expression[]) =>
    f.createCallExpression(
      rest.reduce(
        (acc, entry) =>
          typeof entry === "string" || ts.isIdentifier(entry)
            ? f.createPropertyAccessExpression(acc, entry)
            : f.createElementAccessExpression(acc, entry),
        first,
      ),
      undefined,
      args,
    );

export const makeNew = (cls: ts.Identifier, ...args: ts.Expression[]) =>
  f.createNewExpression(cls, undefined, args);

export const makeExtract = (base: Typeable, narrow: ts.TypeNode) =>
  ensureTypeNode("Extract", [base, narrow]);

export const makeAssignment = (left: ts.Expression, right: ts.Expression) =>
  f.createExpressionStatement(
    f.createBinaryExpression(
      left,
      f.createToken(ts.SyntaxKind.EqualsToken),
      right,
    ),
  );

export const makeIndexed = (subject: Typeable, index: Typeable) =>
  f.createIndexedAccessTypeNode(ensureTypeNode(subject), ensureTypeNode(index));

export const makeMaybeAsync = (subj: Typeable) =>
  f.createUnionTypeNode([ensureTypeNode(subj), makePromise(subj)]);

export const makeFnType = (
  params: Parameters<typeof makeParams>[0],
  returns: Typeable,
) =>
  f.createFunctionTypeNode(
    undefined,
    makeParams(params),
    ensureTypeNode(returns),
  );

/* eslint-disable prettier/prettier -- shorter and works better this way than overrides */
export const literally = <T extends string | null | boolean | number>(subj: T) => (
  typeof subj === "number" ? f.createNumericLiteral(subj) : typeof subj === "boolean"
    ? subj ? f.createTrue() : f.createFalse()
    : subj === null ? f.createNull() : f.createStringLiteral(subj)
  ) as T extends string ? ts.StringLiteral : T extends number ? ts.NumericLiteral
    : T extends boolean ? ts.BooleanLiteral : ts.NullLiteral;
/* eslint-enable prettier/prettier */

export const makeLiteralType = (subj: Parameters<typeof literally>[0]) =>
  f.createLiteralTypeNode(literally(subj));

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
