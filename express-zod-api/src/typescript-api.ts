import * as R from "ramda";
import type ts from "typescript";

export type Typeable =
  | ts.TypeNode
  | ts.Identifier
  | string
  | ts.KeywordTypeSyntaxKind;

type TypeParams =
  | string[]
  | Partial<Record<string, Typeable | { type?: ts.TypeNode; init: Typeable }>>;

export class TypescriptAPI {
  public ts: typeof ts;
  public f: typeof ts.factory;
  public exportModifier: ts.ModifierToken<ts.SyntaxKind.ExportKeyword>[];
  public asyncModifier: ts.ModifierToken<ts.SyntaxKind.AsyncKeyword>[];
  public accessModifiers: Record<"public" | "protectedReadonly", ts.Modifier[]>;
  #primitives: ts.KeywordTypeSyntaxKind[];
  static #safePropRegex = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

  constructor(typescript: typeof ts) {
    this.ts = typescript;
    this.f = this.ts.factory;
    this.exportModifier = [
      this.f.createModifier(this.ts.SyntaxKind.ExportKeyword),
    ];
    this.asyncModifier = [
      this.f.createModifier(this.ts.SyntaxKind.AsyncKeyword),
    ];
    this.accessModifiers = {
      public: [this.f.createModifier(this.ts.SyntaxKind.PublicKeyword)],
      protectedReadonly: [
        this.f.createModifier(this.ts.SyntaxKind.ProtectedKeyword),
        this.f.createModifier(this.ts.SyntaxKind.ReadonlyKeyword),
      ],
    };
    this.#primitives = [
      this.ts.SyntaxKind.AnyKeyword,
      this.ts.SyntaxKind.BigIntKeyword,
      this.ts.SyntaxKind.BooleanKeyword,
      this.ts.SyntaxKind.NeverKeyword,
      this.ts.SyntaxKind.NumberKeyword,
      this.ts.SyntaxKind.ObjectKeyword,
      this.ts.SyntaxKind.StringKeyword,
      this.ts.SyntaxKind.SymbolKeyword,
      this.ts.SyntaxKind.UndefinedKeyword,
      this.ts.SyntaxKind.UnknownKeyword,
      this.ts.SyntaxKind.VoidKeyword,
    ];
  }

  public addJsDoc = <T extends ts.Node>(node: T, text: string) =>
    this.ts.addSyntheticLeadingComment(
      node,
      this.ts.SyntaxKind.MultiLineCommentTrivia,
      `* ${text} `,
      true,
    );

  public printNode = (node: ts.Node, printerOptions?: ts.PrinterOptions) => {
    const sourceFile = this.ts.createSourceFile(
      "print.ts",
      "",
      this.ts.ScriptTarget.Latest,
      false,
      this.ts.ScriptKind.TS,
    );
    const printer = this.ts.createPrinter(printerOptions);
    return printer.printNode(this.ts.EmitHint.Unspecified, node, sourceFile);
  };

  public makeId = (name: string) => this.f.createIdentifier(name);

  public makePropertyIdentifier = (name: string | number) =>
    typeof name === "string" && TypescriptAPI.#safePropRegex.test(name)
      ? this.makeId(name)
      : this.literally(name);

  public makeTemplate = (
    head: string,
    ...rest: [ts.Expression | string, string?][]
  ) =>
    this.f.createTemplateExpression(
      this.f.createTemplateHead(head),
      rest.map(([id, str = ""], idx) =>
        this.f.createTemplateSpan(
          typeof id === "string" ? this.makeId(id) : id,
          idx === rest.length - 1
            ? this.f.createTemplateTail(str)
            : this.f.createTemplateMiddle(str),
        ),
      ),
    );

  public makeParam = (
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
    this.f.createParameterDeclaration(
      mod,
      undefined,
      name,
      optional
        ? this.f.createToken(this.ts.SyntaxKind.QuestionToken)
        : undefined,
      type ? this.ensureTypeNode(type) : undefined,
      init,
    );

  public makeParams = (
    params: Partial<
      Record<string, Typeable | Parameters<typeof this.makeParam>[1]>
    >,
  ) =>
    Object.entries(params).map(([name, value]) =>
      this.makeParam(
        name,
        typeof value === "string" ||
          typeof value === "number" ||
          (typeof value === "object" && "kind" in value)
          ? { type: value }
          : value,
      ),
    );

  public makePublicConstructor = (
    params: ts.ParameterDeclaration[],
    statements: ts.Statement[] = [],
  ) =>
    this.f.createConstructorDeclaration(
      this.accessModifiers.public,
      params,
      this.f.createBlock(statements),
    );

  public ensureTypeNode = (
    subject: Typeable,
    args?: Typeable[], // only for string and id
  ): ts.TypeNode =>
    typeof subject === "number"
      ? this.f.createKeywordTypeNode(subject)
      : typeof subject === "string" || this.ts.isIdentifier(subject)
        ? this.f.createTypeReferenceNode(
            subject,
            args && R.map(this.ensureTypeNode.bind(this), args),
          )
        : subject;

  /**
   * @internal
   * @example Record<string, any>
   * */
  public makeRecordStringAny = () =>
    this.ensureTypeNode("Record", [
      this.ts.SyntaxKind.StringKeyword,
      this.ts.SyntaxKind.AnyKeyword,
    ]);

  /**
   * @internal
   * ensures distinct union (unique primitives)
   * */
  public makeUnion = (entries: ts.TypeNode[]) => {
    const nodes = new Map<
      ts.TypeNode | ts.KeywordTypeSyntaxKind,
      ts.TypeNode
    >();
    for (const entry of entries)
      nodes.set(this.isPrimitive(entry) ? entry.kind : entry, entry);
    return this.f.createUnionTypeNode(Array.from(nodes.values()));
  };

  public makeInterfaceProp = (
    name: string | number,
    value: Typeable,
    {
      isOptional,
      isDeprecated,
      comment,
    }: { isOptional?: boolean; isDeprecated?: boolean; comment?: string } = {},
  ) => {
    const propType = this.ensureTypeNode(value);
    const node = this.f.createPropertySignature(
      undefined,
      this.makePropertyIdentifier(name),
      isOptional
        ? this.f.createToken(this.ts.SyntaxKind.QuestionToken)
        : undefined,
      isOptional
        ? this.makeUnion([
            propType,
            this.ensureTypeNode(this.ts.SyntaxKind.UndefinedKeyword),
          ])
        : propType,
    );
    const jsdoc = R.reject(R.isNil, [
      isDeprecated ? "@deprecated" : undefined,
      comment,
    ]);
    return jsdoc.length ? this.addJsDoc(node, jsdoc.join(" ")) : node;
  };

  public makeOneLine = (subject: ts.TypeNode) =>
    this.ts.setEmitFlags(subject, this.ts.EmitFlags.SingleLine);

  public makeDeconstruction = (...names: string[]): ts.ArrayBindingPattern =>
    this.f.createArrayBindingPattern(
      names.map(
        (name) => this.f.createBindingElement(undefined, undefined, name), // can also add default value at last
      ),
    );

  public makeConst = (
    name: string | ts.Identifier | ts.ArrayBindingPattern,
    value: ts.Expression,
    { type, expose }: { type?: Typeable; expose?: true } = {},
  ) =>
    this.f.createVariableStatement(
      expose && this.exportModifier,
      this.f.createVariableDeclarationList(
        [
          this.f.createVariableDeclaration(
            name,
            undefined,
            type ? this.ensureTypeNode(type) : undefined,
            value,
          ),
        ],
        this.ts.NodeFlags.Const,
      ),
    );

  public makePublicLiteralType = (
    name: ts.Identifier | string,
    literals: string[],
  ) =>
    this.makeType(
      name,
      this.makeUnion(R.map(this.makeLiteralType.bind(this), literals)),
      { expose: true },
    );

  public makeType = (
    name: ts.Identifier | string,
    value: ts.TypeNode,
    {
      expose,
      comment,
      params,
    }: { expose?: boolean; comment?: string; params?: TypeParams } = {},
  ) => {
    const node = this.f.createTypeAliasDeclaration(
      expose ? this.exportModifier : undefined,
      name,
      params && this.makeTypeParams(params),
      value,
    );
    return comment ? this.addJsDoc(node, comment) : node;
  };

  public makePublicProperty = (
    name: string | ts.PropertyName,
    type: Typeable,
  ) =>
    this.f.createPropertyDeclaration(
      this.accessModifiers.public,
      name,
      undefined,
      this.ensureTypeNode(type),
      undefined,
    );

  public makePublicMethod = (
    name: string,
    params: ts.ParameterDeclaration[],
    statements: ts.Statement[],
    {
      typeParams,
      returns,
    }: { typeParams?: TypeParams; returns?: ts.TypeNode } = {},
  ) =>
    this.f.createMethodDeclaration(
      this.accessModifiers.public,
      undefined,
      name,
      undefined,
      typeParams && this.makeTypeParams(typeParams),
      params,
      returns,
      this.f.createBlock(statements),
    );

  public makePublicClass = (
    name: string,
    statements: ts.ClassElement[],
    { typeParams }: { typeParams?: TypeParams } = {},
  ) =>
    this.f.createClassDeclaration(
      this.exportModifier,
      name,
      typeParams && this.makeTypeParams(typeParams),
      undefined,
      statements,
    );

  public makeKeyOf = (subj: Typeable) =>
    this.f.createTypeOperatorNode(
      this.ts.SyntaxKind.KeyOfKeyword,
      this.ensureTypeNode(subj),
    );

  public makePromise = (subject: Typeable) =>
    this.ensureTypeNode(Promise.name, [subject]);

  public makeInterface = (
    name: ts.Identifier | string,
    props: ts.PropertySignature[],
    { expose, comment }: { expose?: boolean; comment?: string } = {},
  ) => {
    const node = this.f.createInterfaceDeclaration(
      expose ? this.exportModifier : undefined,
      name,
      undefined,
      undefined,
      props,
    );
    return comment ? this.addJsDoc(node, comment) : node;
  };

  public makeTypeParams = (
    params:
      | string[]
      | Partial<
          Record<string, Typeable | { type?: ts.TypeNode; init: Typeable }>
        >,
  ) =>
    (Array.isArray(params)
      ? params.map((name) => R.pair(name, undefined))
      : Object.entries(params)
    ).map(([name, val]) => {
      const { type, init } =
        typeof val === "object" && "init" in val ? val : { type: val };
      return this.f.createTypeParameterDeclaration(
        [],
        name,
        type ? this.ensureTypeNode(type) : undefined,
        init ? this.ensureTypeNode(init) : undefined,
      );
    });

  public makeArrowFn = (
    params:
      | Array<Parameters<typeof this.makeParam>[0]>
      | Parameters<typeof this.makeParams>[0],
    body: ts.ConciseBody,
    { isAsync }: { isAsync?: boolean } = {},
  ) =>
    this.f.createArrowFunction(
      isAsync ? this.asyncModifier : undefined,
      undefined,
      Array.isArray(params)
        ? R.map(this.makeParam.bind(this), params)
        : this.makeParams(params),
      undefined,
      undefined,
      body,
    );

  public makeTernary = (
    ...args: [
      ts.Expression | string,
      ts.Expression | string,
      ts.Expression | string,
    ]
  ) => {
    const [condition, positive, negative] = args.map((arg) =>
      typeof arg === "string" ? this.makeId(arg) : arg,
    );
    return this.f.createConditionalExpression(
      condition,
      this.f.createToken(this.ts.SyntaxKind.QuestionToken),
      positive,
      this.f.createToken(this.ts.SyntaxKind.ColonToken),
      negative,
    );
  };

  public makeCall =
    (
      first: ts.Expression | string,
      ...rest: Array<ts.Identifier | ts.ConditionalExpression | string>
    ) =>
    (...args: ts.Expression[]) =>
      this.f.createCallExpression(
        rest.reduce(
          (acc, entry) =>
            typeof entry === "string" || this.ts.isIdentifier(entry)
              ? this.f.createPropertyAccessExpression(acc, entry)
              : this.f.createElementAccessExpression(acc, entry),
          typeof first === "string" ? this.makeId(first) : first,
        ),
        undefined,
        args,
      );

  public makeNew = (cls: string, ...args: ts.Expression[]) =>
    this.f.createNewExpression(this.makeId(cls), undefined, args);

  public makeExtract = (base: Typeable, narrow: ts.TypeNode) =>
    this.ensureTypeNode("Extract", [base, narrow]);

  public makeAssignment = (
    left: ts.Expression | string,
    right: ts.Expression,
  ) =>
    this.f.createExpressionStatement(
      this.f.createBinaryExpression(
        typeof left === "string" ? this.makeId(left) : left,
        this.f.createToken(this.ts.SyntaxKind.EqualsToken),
        right,
      ),
    );

  public makeIndexed = (subject: Typeable, index: Typeable) =>
    this.f.createIndexedAccessTypeNode(
      this.ensureTypeNode(subject),
      this.ensureTypeNode(index),
    );

  public makeMaybeAsync = (subj: Typeable) =>
    this.makeUnion([this.ensureTypeNode(subj), this.makePromise(subj)]);

  public makeFnType = (
    params: Parameters<typeof this.makeParams>[0],
    returns: Typeable,
  ) =>
    this.f.createFunctionTypeNode(
      undefined,
      this.makeParams(params),
      this.ensureTypeNode(returns),
    );

  /* eslint-disable prettier/prettier -- shorter and works better this way than overrides */
  public literally = <T extends string | null | boolean | number | bigint>(subj: T) => (
    typeof subj === "number" ? this.f.createNumericLiteral(subj)
      : typeof subj === "bigint" ? this.f.createBigIntLiteral(subj.toString())
        : typeof subj === "boolean" ? subj ? this.f.createTrue() : this.f.createFalse()
          : subj === null ? this.f.createNull() : this.f.createStringLiteral(subj)
  ) as T extends string ? ts.StringLiteral : T extends number ? ts.NumericLiteral
    : T extends boolean ? ts.BooleanLiteral : ts.NullLiteral;
  /* eslint-enable prettier/prettier */

  public makeLiteralType = (subj: Parameters<typeof this.literally>[0]) =>
    this.f.createLiteralTypeNode(this.literally(subj));

  public isPrimitive = (node: ts.TypeNode): node is ts.KeywordTypeNode =>
    (this.#primitives as ts.SyntaxKind[]).includes(node.kind);
}

export const propOf = <T>(name: keyof NoInfer<T>) => name as string;
