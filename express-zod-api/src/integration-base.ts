import * as R from "ramda";
import ts from "typescript";
import { ResponseVariant } from "./api-response.ts";
import { contentTypes } from "./content-type.ts";
import { ClientMethod, clientMethods } from "./method.ts";
import type { makeEventSchema } from "./sse.ts";
import {
  accessModifiers,
  ensureTypeNode,
  f,
  makeArrowFn,
  makeConst,
  makeDeconstruction,
  makeExtract,
  makeInterface,
  makeInterfaceProp,
  makeKeyOf,
  makeNew,
  makeOneLine,
  makeParam,
  makeParams,
  makePromise,
  makeCall,
  makePropertyIdentifier,
  makePublicConstructor,
  makePublicClass,
  makePublicLiteralType,
  makePublicMethod,
  makeTemplate,
  makeTernary,
  makeType,
  propOf,
  recordStringAny,
  makeAssignment,
  makePublicProperty,
  makeIndexed,
  makeMaybeAsync,
  Typeable,
  makeFnType,
  makeLiteralType,
  literally,
} from "./typescript-api.ts";

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

  readonly #serverUrl: string;

  readonly #ids = {
    pathType: f.createIdentifier("Path"),
    implementationType: f.createIdentifier("Implementation"),
    keyParameter: f.createIdentifier("key"),
    pathParameter: f.createIdentifier("path"),
    paramsArgument: f.createIdentifier("params"),
    ctxArgument: f.createIdentifier("ctx"),
    methodParameter: f.createIdentifier("method"),
    requestParameter: f.createIdentifier("request"),
    eventParameter: f.createIdentifier("event"),
    dataParameter: f.createIdentifier("data"),
    handlerParameter: f.createIdentifier("handler"),
    msgParameter: f.createIdentifier("msg"),
    parseRequestFn: f.createIdentifier("parseRequest"),
    substituteFn: f.createIdentifier("substitute"),
    provideMethod: f.createIdentifier("provide"),
    onMethod: f.createIdentifier("on"),
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
    sourceProp: f.createIdentifier("source"),
  } satisfies Record<string, ts.Identifier>;

  /** @internal */
  protected interfaces: Record<IOKind, ts.Identifier> = {
    input: f.createIdentifier("Input"),
    positive: f.createIdentifier("PositiveResponse"),
    negative: f.createIdentifier("NegativeResponse"),
    encoded: f.createIdentifier("EncodedResponse"),
    response: f.createIdentifier("Response"),
  };

  /**
   * @example export type Method = "get" | "post" | "put" | "delete" | "patch" | "head";
   * @internal
   * */
  protected methodType = makePublicLiteralType("Method", clientMethods);

  /**
   * @example type SomeOf<T> = T[keyof T];
   * @internal
   * */
  protected someOfType = makeType("SomeOf", makeIndexed("T", makeKeyOf("T")), {
    params: ["T"],
  });

  /**
   * @example export type Request = keyof Input;
   * @internal
   * */
  protected requestType = makeType(
    "Request",
    makeKeyOf(this.interfaces.input),
    { expose: true },
  );

  protected constructor(serverUrl: string) {
    this.#serverUrl = serverUrl;
  }

  /**
   * @example SomeOf<_>
   * @internal
   **/
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    ensureTypeNode(this.someOfType.name, [name]);

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
      f.createObjectLiteralExpression(
        Array.from(this.tags).map(([request, tags]) =>
          f.createPropertyAssignment(
            makePropertyIdentifier(request),
            f.createArrayLiteralExpression(R.map(literally, tags)),
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
          [this.#ids.methodParameter.text]: this.methodType.name,
          [this.#ids.pathParameter.text]: ts.SyntaxKind.StringKeyword,
          [this.#ids.paramsArgument.text]: recordStringAny,
          [this.#ids.ctxArgument.text]: { optional: true, type: "T" },
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
        { [this.#ids.requestParameter.text]: ts.SyntaxKind.StringKeyword },
        f.createAsExpression(
          makeCall(this.#ids.requestParameter, propOf<string>("split"))(
            f.createRegularExpressionLiteral("/ (.+)/"), // split once
            literally(2), // excludes third empty element
          ),
          f.createTupleTypeNode([
            ensureTypeNode(this.methodType.name),
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
          [this.#ids.pathParameter.text]: ts.SyntaxKind.StringKeyword,
          [this.#ids.paramsArgument.text]: recordStringAny,
        },
        f.createBlock([
          makeConst(
            this.#ids.restConst,
            f.createObjectLiteralExpression([
              f.createSpreadAssignment(this.#ids.paramsArgument),
            ]),
          ),
          f.createForInStatement(
            f.createVariableDeclarationList(
              [f.createVariableDeclaration(this.#ids.keyParameter)],
              ts.NodeFlags.Const,
            ),
            this.#ids.paramsArgument,
            f.createBlock([
              makeAssignment(
                this.#ids.pathParameter,
                makeCall(this.#ids.pathParameter, propOf<string>("replace"))(
                  makeTemplate(":", [this.#ids.keyParameter]), // `:${key}`
                  makeArrowFn(
                    [],
                    f.createBlock([
                      f.createExpressionStatement(
                        f.createDeleteExpression(
                          f.createElementAccessExpression(
                            this.#ids.restConst,
                            this.#ids.keyParameter,
                          ),
                        ),
                      ),
                      f.createReturnStatement(
                        f.createElementAccessExpression(
                          this.#ids.paramsArgument,
                          this.#ids.keyParameter,
                        ),
                      ),
                    ]),
                  ),
                ),
              ),
            ]),
          ),
          f.createReturnStatement(
            f.createAsExpression(
              f.createArrayLiteralExpression([
                this.#ids.pathParameter,
                this.#ids.restConst,
              ]),
              ensureTypeNode("const"),
            ),
          ),
        ]),
      ),
    );

  // public provide<K extends MethodPath>(request: K, params: Input[K]): Promise<Response[K]> {}
  #makeProvider = () =>
    makePublicMethod(
      this.#ids.provideMethod,
      makeParams({
        [this.#ids.requestParameter.text]: "K",
        [this.#ids.paramsArgument.text]: makeIndexed(
          this.interfaces.input,
          "K",
        ),
        [this.#ids.ctxArgument.text]: { optional: true, type: "T" },
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
        f.createReturnStatement(
          makeCall(f.createThis(), this.#ids.implementationArgument)(
            this.#ids.methodParameter,
            f.createSpreadElement(
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
        typeParams: { K: this.requestType.name },
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
            init: this.#ids.defaultImplementationConst,
          }),
        ]),
        this.#makeProvider(),
      ],
      { typeParams: ["T"] },
    );

  // `?${new URLSearchParams(____)}`
  #makeSearchParams = (from: ts.Expression) =>
    makeTemplate("?", [makeNew(URLSearchParams.name, from)]);

  // new URL(`${path}${searchParams}`, "http:____")
  #makeFetchURL = () =>
    makeNew(
      URL.name,
      makeTemplate(
        "",
        [this.#ids.pathParameter],
        [this.#ids.searchParamsConst],
      ),
      literally(this.#serverUrl),
    );

  /**
   * @example export const defaultImplementation: Implementation = async (method,path,params) => { ___ };
   * @internal
   * */
  protected makeDefaultImplementation = () => {
    // method: method.toUpperCase()
    const methodProperty = f.createPropertyAssignment(
      propOf<RequestInit>("method"),
      makeCall(this.#ids.methodParameter, propOf<string>("toUpperCase"))(),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = f.createPropertyAssignment(
      propOf<RequestInit>("headers"),
      makeTernary(
        this.#ids.hasBodyConst,
        f.createObjectLiteralExpression([
          f.createPropertyAssignment(
            literally("Content-Type"),
            literally(contentTypes.json),
          ),
        ]),
        this.#ids.undefinedValue,
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = f.createPropertyAssignment(
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
      f.createAwaitExpression(
        makeCall(fetch.name)(
          this.#makeFetchURL(),
          f.createObjectLiteralExpression([
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
      f.createLogicalNot(
        makeCall(
          f.createArrayLiteralExpression([
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
    const noBodyStatement = f.createIfStatement(
      f.createPrefixUnaryExpression(
        ts.SyntaxKind.ExclamationToken,
        this.#ids.contentTypeConst,
      ),
      f.createReturnStatement(),
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
    const returnStatement = f.createReturnStatement(
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
            f.createElementAccessExpression(
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
          f.createPropertyAccessExpression(
            f.createThis(),
            this.#ids.sourceProp,
          ),
          makeNew("EventSource", this.#makeFetchURL()),
        ),
      ],
    );

  #makeEventNarrow = (value: Typeable) =>
    f.createTypeLiteralNode([
      makeInterfaceProp(propOf<SSEShape>("event"), value),
    ]);

  #makeOnMethod = () =>
    makePublicMethod(
      this.#ids.onMethod,
      makeParams({
        [this.#ids.eventParameter.text]: "E",
        [this.#ids.handlerParameter.text]: makeFnType(
          {
            [this.#ids.dataParameter.text]: makeIndexed(
              makeExtract("R", makeOneLine(this.#makeEventNarrow("E"))),
              makeLiteralType(propOf<SSEShape>("data")),
            ),
          },
          makeMaybeAsync(ts.SyntaxKind.VoidKeyword),
        ),
      }),
      [
        f.createExpressionStatement(
          makeCall(
            f.createThis(),
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
                  f.createPropertyAccessExpression(
                    f.createParenthesizedExpression(
                      f.createAsExpression(
                        this.#ids.msgParameter,
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
        f.createReturnStatement(f.createThis()),
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
            this.requestType.name,
            f.createTemplateLiteralType(f.createTemplateHead("get "), [
              f.createTemplateLiteralTypeSpan(
                ensureTypeNode(ts.SyntaxKind.StringKeyword),
                f.createTemplateTail(""),
              ),
            ]),
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
      f.createObjectLiteralExpression([
        f.createPropertyAssignment("id", literally("10")),
      ]),
    ),
    // new Subscription("get /v1/events/stream", {}).on("time", (time) => {});
    makeCall(
      makeNew(
        subscriptionClassName,
        literally(`${"get" satisfies ClientMethod} /v1/events/stream`),
        f.createObjectLiteralExpression(),
      ),
      this.#ids.onMethod,
    )(literally("time"), makeArrowFn(["time"], f.createBlock([]))),
  ];
}
