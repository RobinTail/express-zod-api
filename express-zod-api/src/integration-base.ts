import * as R from "ramda";
import type ts from "typescript";
import { ResponseVariant } from "./api-response";
import { contentTypes } from "./content-type";
import { ClientMethod, clientMethods } from "./method";
import type { makeEventSchema } from "./sse";
import { propOf, Typeable, TypescriptAPI } from "./typescript-api";

type IOKind = "input" | "response" | ResponseVariant | "encoded";
type SSEShape = ReturnType<typeof makeEventSchema>["shape"];
type Store = Record<IOKind, ts.TypeNode>;

export abstract class IntegrationBase {
  /** @internal */
  protected api = new TypescriptAPI();
  /** @internal */
  protected paths = new Set<string>();
  /** @internal */
  protected tags = new Map<string, ReadonlyArray<string>>();
  /** @internal */
  protected registry = new Map<
    string,
    { store: Store; isDeprecated: boolean }
  >();

  readonly #ids = {
    pathType: this.api.f.createIdentifier("Path"),
    implementationType: this.api.f.createIdentifier("Implementation"),
    keyParameter: this.api.f.createIdentifier("key"),
    pathParameter: this.api.f.createIdentifier("path"),
    paramsArgument: this.api.f.createIdentifier("params"),
    ctxArgument: this.api.f.createIdentifier("ctx"),
    methodParameter: this.api.f.createIdentifier("method"),
    requestParameter: this.api.f.createIdentifier("request"),
    eventParameter: this.api.f.createIdentifier("event"),
    dataParameter: this.api.f.createIdentifier("data"),
    handlerParameter: this.api.f.createIdentifier("handler"),
    msgParameter: this.api.f.createIdentifier("msg"),
    parseRequestFn: this.api.f.createIdentifier("parseRequest"),
    substituteFn: this.api.f.createIdentifier("substitute"),
    provideMethod: this.api.f.createIdentifier("provide"),
    onMethod: this.api.f.createIdentifier("on"),
    implementationArgument: this.api.f.createIdentifier("implementation"),
    hasBodyConst: this.api.f.createIdentifier("hasBody"),
    undefinedValue: this.api.f.createIdentifier("undefined"),
    responseConst: this.api.f.createIdentifier("response"),
    restConst: this.api.f.createIdentifier("rest"),
    searchParamsConst: this.api.f.createIdentifier("searchParams"),
    defaultImplementationConst: this.api.f.createIdentifier(
      "defaultImplementation",
    ),
    clientConst: this.api.f.createIdentifier("client"),
    contentTypeConst: this.api.f.createIdentifier("contentType"),
    isJsonConst: this.api.f.createIdentifier("isJSON"),
    sourceProp: this.api.f.createIdentifier("source"),
  } satisfies Record<string, ts.Identifier>;

  /** @internal */
  protected interfaces: Record<IOKind, ts.Identifier> = {
    input: this.api.f.createIdentifier("Input"),
    positive: this.api.f.createIdentifier("PositiveResponse"),
    negative: this.api.f.createIdentifier("NegativeResponse"),
    encoded: this.api.f.createIdentifier("EncodedResponse"),
    response: this.api.f.createIdentifier("Response"),
  };

  /**
   * @example export type Method = "get" | "post" | "put" | "delete" | "patch" | "head";
   * @internal
   * */
  protected methodType = this.api.makePublicLiteralType(
    "Method",
    clientMethods,
  );

  /**
   * @example type SomeOf<T> = T[keyof T];
   * @internal
   * */
  protected someOfType = this.api.makeType(
    "SomeOf",
    this.api.makeIndexed("T", this.api.makeKeyOf("T")),
    { params: ["T"] },
  );

  /**
   * @example export type Request = keyof Input;
   * @internal
   * */
  protected requestType = this.api.makeType(
    "Request",
    this.api.makeKeyOf(this.interfaces.input),
    { expose: true },
  );

  protected constructor(private readonly serverUrl: string) {}

  /**
   * @example SomeOf<_>
   * @internal
   **/
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    this.api.ensureTypeNode(this.someOfType.name, [name]);

  /**
   * @example export type Path = "/v1/user/retrieve" | ___;
   * @internal
   * */
  protected makePathType = () =>
    this.api.makePublicLiteralType(this.#ids.pathType, Array.from(this.paths));

  /**
   * @example export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
   * @internal
   * */
  protected makePublicInterfaces = () =>
    (Object.keys(this.interfaces) as IOKind[]).map((kind) =>
      this.api.makeInterface(
        this.interfaces[kind],
        Array.from(this.registry).map(([request, { store, isDeprecated }]) =>
          this.api.makeInterfaceProp(request, store[kind], { isDeprecated }),
        ),
        { expose: true },
      ),
    );

  /**
   * @example export const endpointTags = { "get /v1/user/retrieve": ["users"] }
   * @internal
   * */
  protected makeEndpointTags = () =>
    this.api.makeConst(
      "endpointTags",
      this.api.f.createObjectLiteralExpression(
        Array.from(this.tags).map(([request, tags]) =>
          this.api.f.createPropertyAssignment(
            this.api.makePropertyIdentifier(request),
            this.api.f.createArrayLiteralExpression(
              R.map(this.api.literally.bind(this.api), tags),
            ),
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
    this.api.makeType(
      this.#ids.implementationType,
      this.api.makeFnType(
        {
          [this.#ids.methodParameter.text]: this.methodType.name,
          [this.#ids.pathParameter.text]: this.api.ts.SyntaxKind.StringKeyword,
          [this.#ids.paramsArgument.text]: this.api.makeRecordStringAny(),
          [this.#ids.ctxArgument.text]: { optional: true, type: "T" },
        },
        this.api.makePromise(this.api.ts.SyntaxKind.AnyKeyword),
      ),
      {
        expose: true,
        params: { T: { init: this.api.ts.SyntaxKind.UnknownKeyword } },
      },
    );

  /**
   * @example const parseRequest = (request: string) => request.split(/ (.+)/, 2) as [Method, Path];
   * @internal
   * */
  protected makeParseRequestFn = () =>
    this.api.makeConst(
      this.#ids.parseRequestFn,
      this.api.makeArrowFn(
        {
          [this.#ids.requestParameter.text]:
            this.api.ts.SyntaxKind.StringKeyword,
        },
        this.api.f.createAsExpression(
          this.api.makeCall(
            this.#ids.requestParameter,
            propOf<string>("split"),
          )(
            this.api.f.createRegularExpressionLiteral("/ (.+)/"), // split once
            this.api.literally(2), // excludes third empty element
          ),
          this.api.f.createTupleTypeNode([
            this.api.ensureTypeNode(this.methodType.name),
            this.api.ensureTypeNode(this.#ids.pathType),
          ]),
        ),
      ),
    );

  /**
   * @example const substitute = (path: string, params: Record<string, any>) => { ___ return [path, rest] as const; }
   * @internal
   * */
  protected makeSubstituteFn = () =>
    this.api.makeConst(
      this.#ids.substituteFn,
      this.api.makeArrowFn(
        {
          [this.#ids.pathParameter.text]: this.api.ts.SyntaxKind.StringKeyword,
          [this.#ids.paramsArgument.text]: this.api.makeRecordStringAny(),
        },
        this.api.f.createBlock([
          this.api.makeConst(
            this.#ids.restConst,
            this.api.f.createObjectLiteralExpression([
              this.api.f.createSpreadAssignment(this.#ids.paramsArgument),
            ]),
          ),
          this.api.f.createForInStatement(
            this.api.f.createVariableDeclarationList(
              [this.api.f.createVariableDeclaration(this.#ids.keyParameter)],
              this.api.ts.NodeFlags.Const,
            ),
            this.#ids.paramsArgument,
            this.api.f.createBlock([
              this.api.makeAssignment(
                this.#ids.pathParameter,
                this.api.makeCall(
                  this.#ids.pathParameter,
                  propOf<string>("replace"),
                )(
                  this.api.makeTemplate(":", [this.#ids.keyParameter]), // `:${key}`
                  this.api.makeArrowFn(
                    [],
                    this.api.f.createBlock([
                      this.api.f.createExpressionStatement(
                        this.api.f.createDeleteExpression(
                          this.api.f.createElementAccessExpression(
                            this.#ids.restConst,
                            this.#ids.keyParameter,
                          ),
                        ),
                      ),
                      this.api.f.createReturnStatement(
                        this.api.f.createElementAccessExpression(
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
          this.api.f.createReturnStatement(
            this.api.f.createAsExpression(
              this.api.f.createArrayLiteralExpression([
                this.#ids.pathParameter,
                this.#ids.restConst,
              ]),
              this.api.ensureTypeNode("const"),
            ),
          ),
        ]),
      ),
    );

  // public provide<K extends MethodPath>(request: K, params: Input[K]): Promise<Response[K]> {}
  #makeProvider = () =>
    this.api.makePublicMethod(
      this.#ids.provideMethod,
      this.api.makeParams({
        [this.#ids.requestParameter.text]: "K",
        [this.#ids.paramsArgument.text]: this.api.makeIndexed(
          this.interfaces.input,
          "K",
        ),
        [this.#ids.ctxArgument.text]: { optional: true, type: "T" },
      }),
      [
        this.api.makeConst(
          // const [method, path] = this.parseRequest(request);
          this.api.makeDeconstruction(
            this.#ids.methodParameter,
            this.#ids.pathParameter,
          ),
          this.api.makeCall(this.#ids.parseRequestFn)(
            this.#ids.requestParameter,
          ),
        ),
        // return this.implementation(___)
        this.api.f.createReturnStatement(
          this.api.makeCall(
            this.api.f.createThis(),
            this.#ids.implementationArgument,
          )(
            this.#ids.methodParameter,
            this.api.f.createSpreadElement(
              this.api.makeCall(this.#ids.substituteFn)(
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
        returns: this.api.makePromise(
          this.api.makeIndexed(this.interfaces.response, "K"),
        ),
      },
    );

  /**
   * @example export class Client { ___ }
   * @internal
   * */
  protected makeClientClass = (name: string) =>
    this.api.makePublicClass(
      name,
      [
        // public constructor(protected readonly implementation: Implementation = defaultImplementation) {}
        this.api.makePublicConstructor([
          this.api.makeParam(this.#ids.implementationArgument, {
            type: this.api.ensureTypeNode(this.#ids.implementationType, ["T"]),
            mod: this.api.accessModifiers.protectedReadonly,
            init: this.#ids.defaultImplementationConst,
          }),
        ]),
        this.#makeProvider(),
      ],
      { typeParams: ["T"] },
    );

  // `?${new URLSearchParams(____)}`
  #makeSearchParams = (from: ts.Expression) =>
    this.api.makeTemplate("?", [this.api.makeNew(URLSearchParams.name, from)]);

  // new URL(`${path}${searchParams}`, "http:____")
  #makeFetchURL = () =>
    this.api.makeNew(
      URL.name,
      this.api.makeTemplate(
        "",
        [this.#ids.pathParameter],
        [this.#ids.searchParamsConst],
      ),
      this.api.literally(this.serverUrl),
    );

  /**
   * @example export const defaultImplementation: Implementation = async (method,path,params) => { ___ };
   * @internal
   * */
  protected makeDefaultImplementation = () => {
    // method: method.toUpperCase()
    const methodProperty = this.api.f.createPropertyAssignment(
      propOf<RequestInit>("method"),
      this.api.makeCall(
        this.#ids.methodParameter,
        propOf<string>("toUpperCase"),
      )(),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = this.api.f.createPropertyAssignment(
      propOf<RequestInit>("headers"),
      this.api.makeTernary(
        this.#ids.hasBodyConst,
        this.api.f.createObjectLiteralExpression([
          this.api.f.createPropertyAssignment(
            this.api.literally("Content-Type"),
            this.api.literally(contentTypes.json),
          ),
        ]),
        this.#ids.undefinedValue,
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = this.api.f.createPropertyAssignment(
      propOf<RequestInit>("body"),
      this.api.makeTernary(
        this.#ids.hasBodyConst,
        this.api.makeCall(
          JSON[Symbol.toStringTag],
          propOf<JSON>("stringify"),
        )(this.#ids.paramsArgument),
        this.#ids.undefinedValue,
      ),
    );

    // const response = await fetch(new URL(`${path}${searchParams}`, "https://example.com"), { ___ });
    const responseStatement = this.api.makeConst(
      this.#ids.responseConst,
      this.api.f.createAwaitExpression(
        this.api.makeCall(fetch.name)(
          this.#makeFetchURL(),
          this.api.f.createObjectLiteralExpression([
            methodProperty,
            headersProperty,
            bodyProperty,
          ]),
        ),
      ),
    );

    // const hasBody = !["get", "delete"].includes(method);
    const hasBodyStatement = this.api.makeConst(
      this.#ids.hasBodyConst,
      this.api.f.createLogicalNot(
        this.api.makeCall(
          this.api.f.createArrayLiteralExpression([
            this.api.literally("get" satisfies ClientMethod),
            this.api.literally("head" satisfies ClientMethod),
            this.api.literally("delete" satisfies ClientMethod),
          ]),
          propOf<string[]>("includes"),
        )(this.#ids.methodParameter),
      ),
    );

    // const searchParams = hasBody ? "" : ___;
    const searchParamsStatement = this.api.makeConst(
      this.#ids.searchParamsConst,
      this.api.makeTernary(
        this.#ids.hasBodyConst,
        this.api.literally(""),
        this.#makeSearchParams(this.#ids.paramsArgument),
      ),
    );

    // const contentType = response.headers.get("content-type");
    const contentTypeStatement = this.api.makeConst(
      this.#ids.contentTypeConst,
      this.api.makeCall(
        this.#ids.responseConst,
        propOf<Response>("headers"),
        propOf<Headers>("get"),
      )(this.api.literally("content-type")),
    );

    // if (!contentType) return;
    const noBodyStatement = this.api.f.createIfStatement(
      this.api.f.createPrefixUnaryExpression(
        this.api.ts.SyntaxKind.ExclamationToken,
        this.#ids.contentTypeConst,
      ),
      this.api.f.createReturnStatement(),
    );

    // const isJSON = contentType.startsWith("application/json");
    const isJsonConst = this.api.makeConst(
      this.#ids.isJsonConst,
      this.api.makeCall(
        this.#ids.contentTypeConst,
        propOf<string>("startsWith"),
      )(this.api.literally(contentTypes.json)),
    );

    // return response[isJSON ? "json" : "text"]();
    const returnStatement = this.api.f.createReturnStatement(
      this.api.makeCall(
        this.#ids.responseConst,
        this.api.makeTernary(
          this.#ids.isJsonConst,
          this.api.literally(propOf<Response>("json")),
          this.api.literally(propOf<Response>("text")),
        ),
      )(),
    );

    return this.api.makeConst(
      this.#ids.defaultImplementationConst,
      this.api.makeArrowFn(
        [
          this.#ids.methodParameter,
          this.#ids.pathParameter,
          this.#ids.paramsArgument,
        ],
        this.api.f.createBlock([
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
    this.api.makePublicConstructor(
      this.api.makeParams({
        request: "K",
        params: this.api.makeIndexed(this.interfaces.input, "K"),
      }),
      [
        this.api.makeConst(
          this.api.makeDeconstruction(
            this.#ids.pathParameter,
            this.#ids.restConst,
          ),
          this.api.makeCall(this.#ids.substituteFn)(
            this.api.f.createElementAccessExpression(
              this.api.makeCall(this.#ids.parseRequestFn)(
                this.#ids.requestParameter,
              ),
              this.api.literally(1),
            ),
            this.#ids.paramsArgument,
          ),
        ),
        this.api.makeConst(
          this.#ids.searchParamsConst,
          this.#makeSearchParams(this.#ids.restConst),
        ),
        this.api.makeAssignment(
          this.api.f.createPropertyAccessExpression(
            this.api.f.createThis(),
            this.#ids.sourceProp,
          ),
          this.api.makeNew("EventSource", this.#makeFetchURL()),
        ),
      ],
    );

  #makeEventNarrow = (value: Typeable) =>
    this.api.f.createTypeLiteralNode([
      this.api.makeInterfaceProp(propOf<SSEShape>("event"), value),
    ]);

  #makeOnMethod = () =>
    this.api.makePublicMethod(
      this.#ids.onMethod,
      this.api.makeParams({
        [this.#ids.eventParameter.text]: "E",
        [this.#ids.handlerParameter.text]: this.api.makeFnType(
          {
            [this.#ids.dataParameter.text]: this.api.makeIndexed(
              this.api.makeExtract(
                "R",
                this.api.makeOneLine(this.#makeEventNarrow("E")),
              ),
              this.api.makeLiteralType(propOf<SSEShape>("data")),
            ),
          },
          this.api.makeMaybeAsync(this.api.ts.SyntaxKind.VoidKeyword),
        ),
      }),
      [
        this.api.f.createExpressionStatement(
          this.api.makeCall(
            this.api.f.createThis(),
            this.#ids.sourceProp,
            propOf<EventSource>("addEventListener"),
          )(
            this.#ids.eventParameter,
            this.api.makeArrowFn(
              [this.#ids.msgParameter],
              this.api.makeCall(this.#ids.handlerParameter)(
                this.api.makeCall(
                  JSON[Symbol.toStringTag],
                  propOf<JSON>("parse"),
                )(
                  this.api.f.createPropertyAccessExpression(
                    this.api.f.createParenthesizedExpression(
                      this.api.f.createAsExpression(
                        this.#ids.msgParameter,
                        this.api.ensureTypeNode(MessageEvent.name),
                      ),
                    ),
                    propOf<SSEShape>("data"),
                  ),
                ),
              ),
            ),
          ),
        ),
        this.api.f.createReturnStatement(this.api.f.createThis()),
      ],
      {
        typeParams: {
          E: this.api.makeIndexed(
            "R",
            this.api.makeLiteralType(propOf<SSEShape>("event")),
          ),
        },
      },
    );

  /**
   * @example export class Subscription<K extends Extract<___>, R extends Extract<___>> { ___ }
   * @internal
   * */
  protected makeSubscriptionClass = (name: string) =>
    this.api.makePublicClass(
      name,
      [
        this.api.makePublicProperty(this.#ids.sourceProp, "EventSource"),
        this.#makeSubscriptionConstructor(),
        this.#makeOnMethod(),
      ],
      {
        typeParams: {
          K: this.api.makeExtract(
            this.requestType.name,
            this.api.f.createTemplateLiteralType(
              this.api.f.createTemplateHead("get "),
              [
                this.api.f.createTemplateLiteralTypeSpan(
                  this.api.ensureTypeNode(this.api.ts.SyntaxKind.StringKeyword),
                  this.api.f.createTemplateTail(""),
                ),
              ],
            ),
          ),
          R: this.api.makeExtract(
            this.api.makeIndexed(this.interfaces.positive, "K"),
            this.api.makeOneLine(
              this.#makeEventNarrow(this.api.ts.SyntaxKind.StringKeyword),
            ),
          ),
        },
      },
    );

  /** @internal */
  protected makeUsageStatements = (
    clientClassName: string,
    subscriptionClassName: string,
  ): ts.Node[] => [
    this.api.makeConst(
      this.#ids.clientConst,
      this.api.makeNew(clientClassName),
    ), // const client = new Client();
    // client.provide("get /v1/user/retrieve", { id: "10" });
    this.api.makeCall(this.#ids.clientConst, this.#ids.provideMethod)(
      this.api.literally(`${"get" satisfies ClientMethod} /v1/user/retrieve`),
      this.api.f.createObjectLiteralExpression([
        this.api.f.createPropertyAssignment("id", this.api.literally("10")),
      ]),
    ),
    // new Subscription("get /v1/events/stream", {}).on("time", (time) => {});
    this.api.makeCall(
      this.api.makeNew(
        subscriptionClassName,
        this.api.literally(`${"get" satisfies ClientMethod} /v1/events/stream`),
        this.api.f.createObjectLiteralExpression(),
      ),
      this.#ids.onMethod,
    )(
      this.api.literally("time"),
      this.api.makeArrowFn(["time"], this.api.f.createBlock([])),
    ),
  ];
}
