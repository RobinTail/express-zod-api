import * as R from "ramda";
import type { ResponseVariant } from "./api-response";
import { contentTypes } from "./content-type";
import { clientMethods, type ClientMethod } from "./method";
import type { makeEventSchema } from "./sse";
import {
  type Typeable,
  accessModifiers,
  ensureTypeNode,
  literally,
  makeAssignment,
  makeCall,
  makeConst,
  makeDeconstruction,
  makeExtract,
  makeFnType,
  makeId,
  makeIndexed,
  makeInterface,
  makeInterfaceProp,
  makeKeyOf,
  makeLiteralType,
  makeMaybeAsync,
  makeNew,
  makeOneLine,
  makeParam,
  makeParams,
  makePromise,
  makePropertyIdentifier,
  makePublicClass,
  makePublicConstructor,
  makePublicLiteralType,
  makePublicMethod,
  makePublicProperty,
  makeRecordStringAny,
  makeTemplate,
  makeTernary,
  makeType,
  makeUnion,
  propOf,
  ts,
  makeArrowFn,
} from "./typescript-api";
import type {
  CursorPaginatedResult,
  OffsetPaginatedResult,
} from "./paginated-schema";

type IOKind = "input" | "response" | ResponseVariant | "encoded";
type SSEShape = ReturnType<typeof makeEventSchema>["shape"];
type Store = Record<IOKind, ts.TypeNode>;

export abstract class IntegrationBase {
  /** @internal */
  protected paths = new Set<string>();
  /** @internal */
  protected tags = new Map<string, ReadonlyArray<string>>();
  /** @internal */
  protected registry = new Map<
    string,
    { store: Store; isDeprecated: boolean }
  >();

  protected constructor(protected readonly serverUrl: string) {}

  readonly #ids = {
    pathType: "Path",
    implementationType: "Implementation",
    keyParameter: "key",
    pathParameter: "path",
    paramsArgument: "params",
    ctxArgument: "ctx",
    methodParameter: "method",
    requestParameter: "request",
    eventParameter: "event",
    dataParameter: "data",
    handlerParameter: "handler",
    msgParameter: "msg",
    parseRequestFn: "parseRequest",
    substituteFn: "substitute",
    provideMethod: "provide",
    onMethod: "on",
    implementationArgument: "implementation",
    hasBodyConst: "hasBody",
    undefinedValue: "undefined",
    responseConst: "response",
    restConst: "rest",
    searchParamsConst: "searchParams",
    defaultImplementationConst: "defaultImplementation",
    clientConst: "client",
    contentTypeConst: "contentType",
    isJsonConst: "isJSON",
    sourceProp: "source",
    methodType: "Method",
    someOfType: "SomeOf",
    requestType: "Request",
    paginationType: "Pagination",
  } satisfies Record<string, string>;

  /** @internal */
  protected interfaces: Record<IOKind, string> = {
    input: "Input",
    positive: "PositiveResponse",
    negative: "NegativeResponse",
    encoded: "EncodedResponse",
    response: "Response",
  };

  /**
   * @example export type Method = "get" | "post" | "put" | "delete" | "patch" | "head";
   * @internal
   * */
  protected makeMethodType = () =>
    makePublicLiteralType(this.#ids.methodType, clientMethods);

  /**
   * @example type SomeOf<T> = T[keyof T];
   * @internal
   * */
  protected makeSomeOfType = () =>
    makeType(this.#ids.someOfType, makeIndexed("T", makeKeyOf("T")), {
      params: ["T"],
    });

  /**
   * @example export type Request = keyof Input;
   * @internal
   * */
  protected makeRequestType = () =>
    makeType(this.#ids.requestType, makeKeyOf(this.interfaces.input), {
      expose: true,
    });

  /**
   * @example SomeOf<_>
   * @internal
   **/
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    ensureTypeNode(this.#ids.someOfType, [name]);

  /**
   * @example export type Path = "/v1/user/retrieve" | ___;
   * @internal
   * */
  protected makePathType = () =>
    makePublicLiteralType(this.#ids.pathType, Array.from(this.paths));

  /**
   * @example export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
   * @internal
   * */
  protected makePublicInterfaces = () =>
    (Object.keys(this.interfaces) as IOKind[]).map((kind) =>
      makeInterface(
        this.interfaces[kind],
        Array.from(this.registry).map(([request, { store, isDeprecated }]) =>
          makeInterfaceProp(request, store[kind], { isDeprecated }),
        ),
        { expose: true },
      ),
    );

  /**
   * @example export const endpointTags = { "get /v1/user/retrieve": ["users"] }
   * @internal
   * */
  protected makeEndpointTags = () =>
    makeConst(
      "endpointTags",
      ts.factory.createObjectLiteralExpression(
        Array.from(this.tags).map(([request, tags]) =>
          ts.factory.createPropertyAssignment(
            makePropertyIdentifier(request),
            ts.factory.createArrayLiteralExpression(R.map(literally, tags)),
          ),
        ),
      ),
      { expose: true },
    );

  /**
   * @example export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
   * @internal
   * */
  protected makeImplementationType = () =>
    makeType(
      this.#ids.implementationType,
      makeFnType(
        {
          [this.#ids.methodParameter]: this.#ids.methodType,
          [this.#ids.pathParameter]: ts.SyntaxKind.StringKeyword,
          [this.#ids.paramsArgument]: makeRecordStringAny(),
          [this.#ids.ctxArgument]: { optional: true, type: "T" },
        },
        makePromise(ts.SyntaxKind.AnyKeyword),
      ),
      {
        expose: true,
        params: { T: { init: ts.SyntaxKind.UnknownKeyword } },
      },
    );

  /**
   * @example const parseRequest = (request: string) => request.split(/ (.+)/, 2) as [Method, Path];
   * @internal
   * */
  protected makeParseRequestFn = () =>
    makeConst(
      this.#ids.parseRequestFn,
      makeArrowFn(
        { [this.#ids.requestParameter]: ts.SyntaxKind.StringKeyword },
        ts.factory.createAsExpression(
          makeCall(this.#ids.requestParameter, propOf<string>("split"))(
            ts.factory.createRegularExpressionLiteral("/ (.+)/"), // split once
            literally(2), // excludes third empty element
          ),
          ts.factory.createTupleTypeNode([
            ensureTypeNode(this.#ids.methodType),
            ensureTypeNode(this.#ids.pathType),
          ]),
        ),
      ),
    );

  /**
   * @example const substitute = (path: string, params: Record<string, any>) => { ___ return [path, rest] as const; }
   * @internal
   * */
  protected makeSubstituteFn = () =>
    makeConst(
      this.#ids.substituteFn,
      makeArrowFn(
        {
          [this.#ids.pathParameter]: ts.SyntaxKind.StringKeyword,
          [this.#ids.paramsArgument]: makeRecordStringAny(),
        },
        ts.factory.createBlock([
          makeConst(
            this.#ids.restConst,
            ts.factory.createObjectLiteralExpression([
              ts.factory.createSpreadAssignment(
                makeId(this.#ids.paramsArgument),
              ),
            ]),
          ),
          ts.factory.createForInStatement(
            ts.factory.createVariableDeclarationList(
              [ts.factory.createVariableDeclaration(this.#ids.keyParameter)],
              ts.NodeFlags.Const,
            ),
            makeId(this.#ids.paramsArgument),
            ts.factory.createBlock([
              makeAssignment(
                this.#ids.pathParameter,
                makeCall(this.#ids.pathParameter, propOf<string>("replace"))(
                  makeTemplate(":", [this.#ids.keyParameter]), // `:${key}`
                  makeArrowFn(
                    [],
                    ts.factory.createBlock([
                      ts.factory.createExpressionStatement(
                        ts.factory.createDeleteExpression(
                          ts.factory.createElementAccessExpression(
                            makeId(this.#ids.restConst),
                            makeId(this.#ids.keyParameter),
                          ),
                        ),
                      ),
                      ts.factory.createReturnStatement(
                        ts.factory.createElementAccessExpression(
                          makeId(this.#ids.paramsArgument),
                          makeId(this.#ids.keyParameter),
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
            ]),
          ),
          ts.factory.createReturnStatement(
            ts.factory.createAsExpression(
              ts.factory.createArrayLiteralExpression([
                makeId(this.#ids.pathParameter),
                makeId(this.#ids.restConst),
              ]),
              ensureTypeNode("const"),
            ),
          ),
        ]),
      ),
    );

  /**
   * @example { nextCursor: string | null } | { total, limit, offset: number }
   * @internal
   */
  protected makePaginationType = () => {
    const nextCursorProp =
      propOf<CursorPaginatedResult["output"]["shape"]>("nextCursor");
    const totalProp = propOf<OffsetPaginatedResult["output"]["shape"]>("total");
    const limitProp = propOf<OffsetPaginatedResult["output"]["shape"]>("limit");
    const offsetProp =
      propOf<OffsetPaginatedResult["output"]["shape"]>("offset");
    const cursorShape = ts.factory.createTypeLiteralNode([
      makeInterfaceProp(
        nextCursorProp,
        makeUnion([
          ensureTypeNode(ts.SyntaxKind.StringKeyword),
          makeLiteralType(null),
        ]),
      ),
    ]);
    const offsetShape = ts.factory.createTypeLiteralNode(
      [totalProp, limitProp, offsetProp].map((prop) =>
        makeInterfaceProp(prop, ts.SyntaxKind.NumberKeyword),
      ),
    );
    return makeType(
      this.#ids.paginationType,
      makeUnion([cursorShape, offsetShape]),
    );
  };

  /**
   * static hasMore(response: Pagination): boolean
   * @internal
   */
  #makeHasMoreMethod = () => {
    const responseId = makeId(this.#ids.responseConst);
    const nextCursorProp =
      propOf<CursorPaginatedResult["output"]["shape"]>("nextCursor");
    const totalProp = propOf<OffsetPaginatedResult["output"]["shape"]>("total");
    const limitProp = propOf<OffsetPaginatedResult["output"]["shape"]>("limit");
    const offsetProp =
      propOf<OffsetPaginatedResult["output"]["shape"]>("offset");
    const inExpression = ts.factory.createBinaryExpression(
      literally(nextCursorProp),
      ts.SyntaxKind.InKeyword,
      responseId,
    );
    const returnCursor = ts.factory.createReturnStatement(
      ts.factory.createBinaryExpression(
        ts.factory.createPropertyAccessExpression(responseId, nextCursorProp),
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        literally(null),
      ),
    );
    const offsetPlusLimit = ts.factory.createBinaryExpression(
      ts.factory.createPropertyAccessExpression(responseId, offsetProp),
      ts.SyntaxKind.PlusToken,
      ts.factory.createPropertyAccessExpression(responseId, limitProp),
    );
    const returnOffset = ts.factory.createReturnStatement(
      ts.factory.createBinaryExpression(
        offsetPlusLimit,
        ts.SyntaxKind.LessThanToken,
        ts.factory.createPropertyAccessExpression(responseId, totalProp),
      ),
    );
    return makePublicMethod(
      "hasMore",
      [makeParam(responseId, { type: this.#ids.paginationType })],
      [ts.factory.createIfStatement(inExpression, returnCursor), returnOffset],
      {
        returns: ensureTypeNode(ts.SyntaxKind.BooleanKeyword),
        isStatic: true,
      },
    );
  };

  // public provide<K extends MethodPath>(request: K, params: Input[K]): Promise<Response[K]> {}
  #makeProvider = () =>
    makePublicMethod(
      this.#ids.provideMethod,
      makeParams({
        [this.#ids.requestParameter]: "K",
        [this.#ids.paramsArgument]: makeIndexed(this.interfaces.input, "K"),
        [this.#ids.ctxArgument]: { optional: true, type: "T" },
      }),
      [
        makeConst(
          // const [method, path] = this.parseRequest(request);
          makeDeconstruction(
            this.#ids.methodParameter,
            this.#ids.pathParameter,
          ),
          makeCall(this.#ids.parseRequestFn)(this.#ids.requestParameter),
        ),
        // return this.implementation(___)
        ts.factory.createReturnStatement(
          makeCall(ts.factory.createThis(), this.#ids.implementationArgument)(
            this.#ids.methodParameter,
            ts.factory.createSpreadElement(
              makeCall(this.#ids.substituteFn)(
                this.#ids.pathParameter,
                this.#ids.paramsArgument,
              ),
            ),
            this.#ids.ctxArgument,
          ),
        ),
      ],
      {
        typeParams: { K: this.#ids.requestType },
        returns: makePromise(makeIndexed(this.interfaces.response, "K")),
      },
    );

  /**
   * @example export class Client { ___ }
   * @internal
   * */
  protected makeClientClass = (name: string) =>
    makePublicClass(
      name,
      [
        // public constructor(protected readonly implementation: Implementation = defaultImplementation) {}
        makePublicConstructor([
          makeParam(this.#ids.implementationArgument, {
            type: ensureTypeNode(this.#ids.implementationType, ["T"]),
            mod: accessModifiers.protectedReadonly,
            initId: this.#ids.defaultImplementationConst,
          }),
        ]),
        this.#makeProvider(),
        this.#makeHasMoreMethod(),
      ],
      { typeParams: ["T"] },
    );

  // `?${new URLSearchParams(____)}`
  #makeSearchParams = (fromId: string) =>
    makeTemplate("?", [makeNew(URLSearchParams.name, makeId(fromId))]);

  // new URL(`${path}${searchParams}`, "http:____")
  #makeFetchURL = () =>
    makeNew(
      URL.name,
      makeTemplate(
        "",
        [this.#ids.pathParameter],
        [this.#ids.searchParamsConst],
      ),
      literally(this.serverUrl),
    );

  /**
   * @example export const defaultImplementation: Implementation = async (method,path,params) => { ___ };
   * @internal
   * */
  protected makeDefaultImplementation = () => {
    // method: method.toUpperCase()
    const methodProperty = ts.factory.createPropertyAssignment(
      propOf<RequestInit>("method"),
      makeCall(this.#ids.methodParameter, propOf<string>("toUpperCase"))(),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = ts.factory.createPropertyAssignment(
      propOf<RequestInit>("headers"),
      makeTernary(
        this.#ids.hasBodyConst,
        ts.factory.createObjectLiteralExpression([
          ts.factory.createPropertyAssignment(
            literally("Content-Type"),
            literally(contentTypes.json),
          ),
        ]),
        this.#ids.undefinedValue,
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = ts.factory.createPropertyAssignment(
      propOf<RequestInit>("body"),
      makeTernary(
        this.#ids.hasBodyConst,
        makeCall(
          JSON[Symbol.toStringTag],
          propOf<JSON>("stringify"),
        )(this.#ids.paramsArgument),
        this.#ids.undefinedValue,
      ),
    );

    // const response = await fetch(new URL(`${path}${searchParams}`, "https://example.com"), { ___ });
    const responseStatement = makeConst(
      this.#ids.responseConst,
      ts.factory.createAwaitExpression(
        makeCall(fetch.name)(
          this.#makeFetchURL(),
          ts.factory.createObjectLiteralExpression([
            methodProperty,
            headersProperty,
            bodyProperty,
          ]),
        ),
      ),
    );

    // const hasBody = !["get", "delete"].includes(method);
    const hasBodyStatement = makeConst(
      this.#ids.hasBodyConst,
      ts.factory.createLogicalNot(
        makeCall(
          ts.factory.createArrayLiteralExpression([
            literally("get" satisfies ClientMethod),
            literally("head" satisfies ClientMethod),
            literally("delete" satisfies ClientMethod),
          ]),
          propOf<string[]>("includes"),
        )(this.#ids.methodParameter),
      ),
    );

    // const searchParams = hasBody ? "" : ___;
    const searchParamsStatement = makeConst(
      this.#ids.searchParamsConst,
      makeTernary(
        this.#ids.hasBodyConst,
        literally(""),
        this.#makeSearchParams(this.#ids.paramsArgument),
      ),
    );

    // const contentType = response.headers.get("content-type");
    const contentTypeStatement = makeConst(
      this.#ids.contentTypeConst,
      makeCall(
        this.#ids.responseConst,
        propOf<Response>("headers"),
        propOf<Headers>("get"),
      )(literally("content-type")),
    );

    // if (!contentType) return;
    const noBodyStatement = ts.factory.createIfStatement(
      ts.factory.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        makeId(this.#ids.contentTypeConst),
      ),
      ts.factory.createReturnStatement(),
    );

    // const isJSON = contentType.startsWith("application/json");
    const isJsonConst = makeConst(
      this.#ids.isJsonConst,
      makeCall(
        this.#ids.contentTypeConst,
        propOf<string>("startsWith"),
      )(literally(contentTypes.json)),
    );

    // return response[isJSON ? "json" : "text"]();
    const returnStatement = ts.factory.createReturnStatement(
      makeCall(
        this.#ids.responseConst,
        makeTernary(
          this.#ids.isJsonConst,
          literally(propOf<Response>("json")),
          literally(propOf<Response>("text")),
        ),
      )(),
    );

    return makeConst(
      this.#ids.defaultImplementationConst,
      makeArrowFn(
        [
          this.#ids.methodParameter,
          this.#ids.pathParameter,
          this.#ids.paramsArgument,
        ],
        ts.factory.createBlock([
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
      { type: this.#ids.implementationType },
    );
  };

  #makeSubscriptionConstructor = () =>
    makePublicConstructor(
      makeParams({
        request: "K",
        params: makeIndexed(this.interfaces.input, "K"),
      }),
      [
        makeConst(
          makeDeconstruction(this.#ids.pathParameter, this.#ids.restConst),
          makeCall(this.#ids.substituteFn)(
            ts.factory.createElementAccessExpression(
              makeCall(this.#ids.parseRequestFn)(this.#ids.requestParameter),
              literally(1),
            ),
            this.#ids.paramsArgument,
          ),
        ),
        makeConst(
          this.#ids.searchParamsConst,
          this.#makeSearchParams(this.#ids.restConst),
        ),
        makeAssignment(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createThis(),
            this.#ids.sourceProp,
          ),
          makeNew("EventSource", this.#makeFetchURL()),
        ),
      ],
    );

  #makeEventNarrow = (value: Typeable) =>
    ts.factory.createTypeLiteralNode([
      makeInterfaceProp(propOf<SSEShape>("event"), value),
    ]);

  #makeOnMethod = () =>
    makePublicMethod(
      this.#ids.onMethod,
      makeParams({
        [this.#ids.eventParameter]: "E",
        [this.#ids.handlerParameter]: makeFnType(
          {
            [this.#ids.dataParameter]: makeIndexed(
              makeExtract("R", makeOneLine(this.#makeEventNarrow("E"))),
              makeLiteralType(propOf<SSEShape>("data")),
            ),
          },
          makeMaybeAsync(ts.SyntaxKind.VoidKeyword),
        ),
      }),
      [
        ts.factory.createExpressionStatement(
          makeCall(
            ts.factory.createThis(),
            this.#ids.sourceProp,
            propOf<EventSource>("addEventListener"),
          )(
            this.#ids.eventParameter,
            makeArrowFn(
              [this.#ids.msgParameter],
              makeCall(this.#ids.handlerParameter)(
                makeCall(
                  JSON[Symbol.toStringTag],
                  propOf<JSON>("parse"),
                )(
                  ts.factory.createPropertyAccessExpression(
                    ts.factory.createParenthesizedExpression(
                      ts.factory.createAsExpression(
                        makeId(this.#ids.msgParameter),
                        ensureTypeNode(MessageEvent.name),
                      ),
                    ),
                    propOf<SSEShape>("data"),
                  ),
                ),
              ),
            ),
          ),
        ),
        ts.factory.createReturnStatement(ts.factory.createThis()),
      ],
      {
        typeParams: {
          E: makeIndexed("R", makeLiteralType(propOf<SSEShape>("event"))),
        },
      },
    );

  /**
   * @example export class Subscription<K extends Extract<___>, R extends Extract<___>> { ___ }
   * @internal
   * */
  protected makeSubscriptionClass = (name: string) =>
    makePublicClass(
      name,
      [
        makePublicProperty(this.#ids.sourceProp, "EventSource"),
        this.#makeSubscriptionConstructor(),
        this.#makeOnMethod(),
      ],
      {
        typeParams: {
          K: makeExtract(
            this.#ids.requestType,
            ts.factory.createTemplateLiteralType(
              ts.factory.createTemplateHead("get "),
              [
                ts.factory.createTemplateLiteralTypeSpan(
                  ensureTypeNode(ts.SyntaxKind.StringKeyword),
                  ts.factory.createTemplateTail(""),
                ),
              ],
            ),
          ),
          R: makeExtract(
            makeIndexed(this.interfaces.positive, "K"),
            makeOneLine(this.#makeEventNarrow(ts.SyntaxKind.StringKeyword)),
          ),
        },
      },
    );

  /** @internal */
  protected makeUsageStatements = (
    clientClassName: string,
    subscriptionClassName: string,
  ): ts.Node[] => [
    makeConst(this.#ids.clientConst, makeNew(clientClassName)), // const client = new Client();
    // client.provide("get /v1/user/retrieve", { id: "10" });
    makeCall(this.#ids.clientConst, this.#ids.provideMethod)(
      literally(`${"get" satisfies ClientMethod} /v1/user/retrieve`),
      ts.factory.createObjectLiteralExpression([
        ts.factory.createPropertyAssignment("id", literally("10")),
      ]),
    ),
    // new Subscription("get /v1/events/stream", {}).on("time", (time) => {});
    makeCall(
      makeNew(
        subscriptionClassName,
        literally(`${"get" satisfies ClientMethod} /v1/events/stream`),
        ts.factory.createObjectLiteralExpression(),
      ),
      this.#ids.onMethod,
    )(literally("time"), makeArrowFn(["time"], ts.factory.createBlock([]))),
  ];
}
