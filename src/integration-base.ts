import ts from "typescript";
import { ResponseVariant } from "./api-response";
import { contentTypes } from "./content-type";
import { Method, methods } from "./method";
import {
  accessModifiers,
  ensureTypeNode,
  f,
  makeArrowFn,
  makeConst,
  makeDeconstruction,
  makeEmptyInitializingConstructor,
  makeInterface,
  makeInterfaceProp,
  makeKeyOf,
  makeNew,
  makeParam,
  makeParams,
  makePromise,
  makePropCall,
  makePropertyIdentifier,
  makePublicClass,
  makePublicLiteralType,
  makePublicMethod,
  makeTemplate,
  makeTernary,
  makeType,
  propOf,
  recordStringAny,
} from "./typescript-api";

type IOKind = "input" | "response" | ResponseVariant | "encoded";

export abstract class IntegrationBase {
  protected paths = new Set<string>();
  protected tags = new Map<string, ReadonlyArray<string>>();
  protected registry = new Map<string, Record<IOKind, ts.TypeNode>>();

  protected ids = {
    pathType: f.createIdentifier("Path"),
    implementationType: f.createIdentifier("Implementation"),
    clientClass: f.createIdentifier("ExpressZodAPIClient"),
    keyParameter: f.createIdentifier("key"),
    pathParameter: f.createIdentifier("path"),
    paramsArgument: f.createIdentifier("params"),
    methodParameter: f.createIdentifier("method"),
    requestParameter: f.createIdentifier("request"),
    parseRequestFn: f.createIdentifier("parseRequest"),
    substituteFn: f.createIdentifier("substitute"),
    provideMethod: f.createIdentifier("provide"),
    implementationArgument: f.createIdentifier("implementation"),
    hasBodyConst: f.createIdentifier("hasBody"),
    undefinedValue: f.createIdentifier("undefined"),
    responseConst: f.createIdentifier("response"),
    restConst: f.createIdentifier("rest"),
    searchParamsConst: f.createIdentifier("searchParams"),
    defaultImplementationConst: f.createIdentifier("defaultImplementation"),
    clientConst: f.createIdentifier("client"),
    contentTypeConst: f.createIdentifier("contentType"),
    isJsonConst: f.createIdentifier("isJSON"),
  } satisfies Record<string, ts.Identifier>;

  protected interfaces: Record<IOKind, ts.Identifier> = {
    input: f.createIdentifier("Input"),
    positive: f.createIdentifier("PositiveResponse"),
    negative: f.createIdentifier("NegativeResponse"),
    encoded: f.createIdentifier("EncodedResponse"),
    response: f.createIdentifier("Response"),
  };

  // export type Method = "get" | "post" | "put" | "delete" | "patch";
  protected methodType = makePublicLiteralType("Method", methods);

  // type SomeOf<T> = T[keyof T];
  protected someOfType = makeType(
    "SomeOf",
    f.createIndexedAccessTypeNode(ensureTypeNode("T"), makeKeyOf("T")),
    { params: { T: undefined } },
  );

  // export type Request = keyof Input;
  protected requestType = makeType(
    "Request",
    makeKeyOf(this.interfaces.input),
    { expose: true },
  );

  protected constructor(private readonly serverUrl: string) {}

  /** @example SomeOf<_> */
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    f.createTypeReferenceNode(this.someOfType.name, [ensureTypeNode(name)]);

  // export type Path = "/v1/user/retrieve" | ___;
  protected makePathType = () =>
    makePublicLiteralType(this.ids.pathType, Array.from(this.paths));

  // export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
  protected makePublicInterfaces = () =>
    (Object.keys(this.interfaces) as IOKind[]).map((kind) =>
      makeInterface(
        this.interfaces[kind],
        Array.from(this.registry).map(([request, faces]) =>
          makeInterfaceProp(request, faces[kind]),
        ),
        { expose: true },
      ),
    );

  // export const endpointTags = { "get /v1/user/retrieve": ["users"] }
  protected makeEndpointTags = () =>
    makeConst(
      "endpointTags",
      f.createObjectLiteralExpression(
        Array.from(this.tags).map(([request, tags]) =>
          f.createPropertyAssignment(
            makePropertyIdentifier(request),
            f.createArrayLiteralExpression(
              tags.map((tag) => f.createStringLiteral(tag)),
            ),
          ),
        ),
      ),
      { expose: true },
    );

  // export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
  protected makeImplementationType = () =>
    makeType(
      this.ids.implementationType,
      f.createFunctionTypeNode(
        undefined,
        makeParams({
          [this.ids.methodParameter.text]: ensureTypeNode(this.methodType.name),
          [this.ids.pathParameter.text]: f.createKeywordTypeNode(
            ts.SyntaxKind.StringKeyword,
          ),
          [this.ids.paramsArgument.text]: recordStringAny,
        }),
        makePromise("any"),
      ),
      { expose: true },
    );

  // const parseRequest = (request: string) => request.split(/ (.+)/, 2) as [Method, Path];
  protected makeParseRequestFn = () =>
    makeConst(
      this.ids.parseRequestFn,
      makeArrowFn(
        {
          [this.ids.requestParameter.text]: f.createKeywordTypeNode(
            ts.SyntaxKind.StringKeyword,
          ),
        },
        f.createAsExpression(
          makePropCall(this.ids.requestParameter, propOf<string>("split"), [
            f.createRegularExpressionLiteral("/ (.+)/"), // split once
            f.createNumericLiteral(2), // excludes third empty element
          ]),
          f.createTupleTypeNode([
            ensureTypeNode(this.methodType.name),
            ensureTypeNode(this.ids.pathType),
          ]),
        ),
      ),
    );

  // const substitute = (path: string, params: Record<string, any>) => { ___ return [path, rest] as const; }
  protected makeSubstituteFn = () =>
    makeConst(
      this.ids.substituteFn,
      makeArrowFn(
        {
          [this.ids.pathParameter.text]: f.createKeywordTypeNode(
            ts.SyntaxKind.StringKeyword,
          ),
          [this.ids.paramsArgument.text]: recordStringAny,
        },
        f.createBlock([
          makeConst(
            this.ids.restConst,
            f.createObjectLiteralExpression([
              f.createSpreadAssignment(this.ids.paramsArgument),
            ]),
          ),
          f.createForInStatement(
            f.createVariableDeclarationList(
              [f.createVariableDeclaration(this.ids.keyParameter)],
              ts.NodeFlags.Const,
            ),
            this.ids.paramsArgument,
            f.createBlock([
              f.createExpressionStatement(
                f.createBinaryExpression(
                  this.ids.pathParameter,
                  f.createToken(ts.SyntaxKind.EqualsToken),
                  makePropCall(
                    this.ids.pathParameter,
                    propOf<string>("replace"),
                    [
                      makeTemplate(":", [this.ids.keyParameter]), // `:${key}`
                      makeArrowFn(
                        [],
                        f.createBlock([
                          f.createExpressionStatement(
                            f.createDeleteExpression(
                              f.createElementAccessExpression(
                                f.createIdentifier("rest"),
                                this.ids.keyParameter,
                              ),
                            ),
                          ),
                          f.createReturnStatement(
                            f.createElementAccessExpression(
                              this.ids.paramsArgument,
                              this.ids.keyParameter,
                            ),
                          ),
                        ]),
                      ),
                    ],
                  ),
                ),
              ),
            ]),
          ),
          f.createReturnStatement(
            f.createAsExpression(
              f.createArrayLiteralExpression([
                this.ids.pathParameter,
                this.ids.restConst,
              ]),
              ensureTypeNode("const"),
            ),
          ),
        ]),
      ),
    );

  // public provide<K extends MethodPath>(request: K, params: Input[K]): Promise<Response[K]> {}
  private makeProvider = () =>
    makePublicMethod(
      this.ids.provideMethod,
      makeParams({
        [this.ids.requestParameter.text]: ensureTypeNode("K"),
        [this.ids.paramsArgument.text]: f.createIndexedAccessTypeNode(
          ensureTypeNode(this.interfaces.input),
          ensureTypeNode("K"),
        ),
      }),
      f.createBlock([
        makeConst(
          // const [method, path] = this.parseRequest(request);
          makeDeconstruction(this.ids.methodParameter, this.ids.pathParameter),
          f.createCallExpression(this.ids.parseRequestFn, undefined, [
            this.ids.requestParameter,
          ]),
        ),
        // return this.implementation(___)
        f.createReturnStatement(
          makePropCall(f.createThis(), this.ids.implementationArgument, [
            this.ids.methodParameter,
            f.createSpreadElement(
              f.createCallExpression(this.ids.substituteFn, undefined, [
                this.ids.pathParameter,
                this.ids.paramsArgument,
              ]),
            ),
          ]),
        ),
      ]),
      {
        typeParams: { K: this.requestType.name },
        returns: makePromise(
          f.createIndexedAccessTypeNode(
            ensureTypeNode(this.interfaces.response),
            ensureTypeNode("K"),
          ),
        ),
      },
    );

  // export class ExpressZodAPIClient { ___ }
  protected makeClientClass = () =>
    makePublicClass(
      this.ids.clientClass,
      // constructor(protected readonly implementation: Implementation = defaultImplementation) {}
      makeEmptyInitializingConstructor([
        makeParam(this.ids.implementationArgument, {
          type: ensureTypeNode(this.ids.implementationType),
          mod: accessModifiers.protectedReadonly,
          init: this.ids.defaultImplementationConst,
        }),
      ]),
      [this.makeProvider()],
    );

  // export const exampleImplementation: Implementation = async (method,path,params) => { ___ };
  protected makeDefaultImplementation = () => {
    // method: method.toUpperCase()
    const methodProperty = f.createPropertyAssignment(
      propOf<RequestInit>("method"),
      makePropCall(this.ids.methodParameter, propOf<string>("toUpperCase")),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = f.createPropertyAssignment(
      propOf<RequestInit>("headers"),
      makeTernary(
        this.ids.hasBodyConst,
        f.createObjectLiteralExpression([
          f.createPropertyAssignment(
            f.createStringLiteral("Content-Type"),
            f.createStringLiteral(contentTypes.json),
          ),
        ]),
        this.ids.undefinedValue,
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = f.createPropertyAssignment(
      propOf<RequestInit>("body"),
      makeTernary(
        this.ids.hasBodyConst,
        makePropCall(
          f.createIdentifier(JSON[Symbol.toStringTag]),
          propOf<JSON>("stringify"),
          [this.ids.paramsArgument],
        ),
        this.ids.undefinedValue,
      ),
    );

    // const response = await fetch(new URL(`${path}${searchParams}`, "https://example.com"), { ___ });
    const responseStatement = makeConst(
      this.ids.responseConst,
      f.createAwaitExpression(
        f.createCallExpression(f.createIdentifier(fetch.name), undefined, [
          makeNew(
            f.createIdentifier(URL.name),
            makeTemplate(
              "",
              [this.ids.pathParameter],
              [this.ids.searchParamsConst],
            ),
            f.createStringLiteral(this.serverUrl),
          ),
          f.createObjectLiteralExpression([
            methodProperty,
            headersProperty,
            bodyProperty,
          ]),
        ]),
      ),
    );

    // const hasBody = !["get", "delete"].includes(method);
    const hasBodyStatement = makeConst(
      this.ids.hasBodyConst,
      f.createLogicalNot(
        makePropCall(
          f.createArrayLiteralExpression([
            f.createStringLiteral("get" satisfies Method),
            f.createStringLiteral("delete" satisfies Method),
          ]),
          propOf<string[]>("includes"),
          [this.ids.methodParameter],
        ),
      ),
    );

    // const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
    const searchParamsStatement = makeConst(
      this.ids.searchParamsConst,
      makeTernary(
        this.ids.hasBodyConst,
        f.createStringLiteral(""),
        makeTemplate("?", [
          makeNew(
            f.createIdentifier(URLSearchParams.name),
            this.ids.paramsArgument,
          ),
        ]),
      ),
    );

    // const contentType = response.headers.get("content-type");
    const contentTypeStatement = makeConst(
      this.ids.contentTypeConst,
      makePropCall(
        [this.ids.responseConst, propOf<Response>("headers")],
        propOf<Headers>("get"),
        [f.createStringLiteral("content-type")],
      ),
    );

    // if (!contentType) return;
    const noBodyStatement = f.createIfStatement(
      f.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        this.ids.contentTypeConst,
      ),
      f.createReturnStatement(),
    );

    // const isJSON = contentType.startsWith("application/json");
    const isJsonConst = makeConst(
      this.ids.isJsonConst,
      makePropCall(this.ids.contentTypeConst, propOf<string>("startsWith"), [
        f.createStringLiteral(contentTypes.json),
      ]),
    );

    // return response[isJSON ? "json" : "text"]();
    const returnStatement = f.createReturnStatement(
      f.createCallExpression(
        f.createElementAccessExpression(
          this.ids.responseConst,
          makeTernary(
            this.ids.isJsonConst,
            f.createStringLiteral(propOf<Response>("json")),
            f.createStringLiteral(propOf<Response>("text")),
          ),
        ),
        undefined,
        [],
      ),
    );

    return makeConst(
      this.ids.defaultImplementationConst,
      makeArrowFn(
        [
          this.ids.methodParameter,
          this.ids.pathParameter,
          this.ids.paramsArgument,
        ],
        f.createBlock([
          hasBodyStatement,
          searchParamsStatement,
          responseStatement,
          contentTypeStatement,
          noBodyStatement,
          isJsonConst,
          returnStatement,
        ]),
        { isAsync: true },
      ),
      { type: ensureTypeNode(this.ids.implementationType) },
    );
  };

  protected makeUsageStatements = () => [
    makeConst(this.ids.clientConst, makeNew(this.ids.clientClass)), // const client = new ExpressZodAPIClient();
    // client.provide("get /v1/user/retrieve", { id: "10" });
    f.createExpressionStatement(
      makePropCall(this.ids.clientConst, this.ids.provideMethod, [
        f.createStringLiteral(`${"get" satisfies Method} /v1/user/retrieve`),
        f.createObjectLiteralExpression([
          f.createPropertyAssignment("id", f.createStringLiteral("10")),
        ]),
      ]),
    ),
  ];
}
