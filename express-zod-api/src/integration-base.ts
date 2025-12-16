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

export abstract class IntegrationBase extends TypescriptAPI {
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
    pathType: this.f.createIdentifier("Path"),
    implementationType: this.f.createIdentifier("Implementation"),
    keyParameter: this.f.createIdentifier("key"),
    pathParameter: this.f.createIdentifier("path"),
    paramsArgument: this.f.createIdentifier("params"),
    ctxArgument: this.f.createIdentifier("ctx"),
    methodParameter: this.f.createIdentifier("method"),
    requestParameter: this.f.createIdentifier("request"),
    eventParameter: this.f.createIdentifier("event"),
    dataParameter: this.f.createIdentifier("data"),
    handlerParameter: this.f.createIdentifier("handler"),
    msgParameter: this.f.createIdentifier("msg"),
    parseRequestFn: this.f.createIdentifier("parseRequest"),
    substituteFn: this.f.createIdentifier("substitute"),
    provideMethod: this.f.createIdentifier("provide"),
    onMethod: this.f.createIdentifier("on"),
    implementationArgument: this.f.createIdentifier("implementation"),
    hasBodyConst: this.f.createIdentifier("hasBody"),
    undefinedValue: this.f.createIdentifier("undefined"),
    responseConst: this.f.createIdentifier("response"),
    restConst: this.f.createIdentifier("rest"),
    searchParamsConst: this.f.createIdentifier("searchParams"),
    defaultImplementationConst: this.f.createIdentifier(
      "defaultImplementation",
    ),
    clientConst: this.f.createIdentifier("client"),
    contentTypeConst: this.f.createIdentifier("contentType"),
    isJsonConst: this.f.createIdentifier("isJSON"),
    sourceProp: this.f.createIdentifier("source"),
  } satisfies Record<string, ts.Identifier>;

  /** @internal */
  protected interfaces: Record<IOKind, ts.Identifier> = {
    input: this.f.createIdentifier("Input"),
    positive: this.f.createIdentifier("PositiveResponse"),
    negative: this.f.createIdentifier("NegativeResponse"),
    encoded: this.f.createIdentifier("EncodedResponse"),
    response: this.f.createIdentifier("Response"),
  };

  /**
   * @example export type Method = "get" | "post" | "put" | "delete" | "patch" | "head";
   * @internal
   * */
  protected methodType = this.makePublicLiteralType("Method", clientMethods);

  /**
   * @example type SomeOf<T> = T[keyof T];
   * @internal
   * */
  protected someOfType = this.makeType(
    "SomeOf",
    this.makeIndexed("T", this.makeKeyOf("T")),
    { params: ["T"] },
  );

  /**
   * @example export type Request = keyof Input;
   * @internal
   * */
  protected requestType = this.makeType(
    "Request",
    this.makeKeyOf(this.interfaces.input),
    { expose: true },
  );

  protected constructor(private readonly serverUrl: string) {
    super();
  }

  /**
   * @example SomeOf<_>
   * @internal
   **/
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    this.ensureTypeNode(this.someOfType.name, [name]);

  /**
   * @example export type Path = "/v1/user/retrieve" | ___;
   * @internal
   * */
  protected makePathType = () =>
    this.makePublicLiteralType(this.#ids.pathType, Array.from(this.paths));

  /**
   * @example export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
   * @internal
   * */
  protected makePublicInterfaces = () =>
    (Object.keys(this.interfaces) as IOKind[]).map((kind) =>
      this.makeInterface(
        this.interfaces[kind],
        Array.from(this.registry).map(([request, { store, isDeprecated }]) =>
          this.makeInterfaceProp(request, store[kind], { isDeprecated }),
        ),
        { expose: true },
      ),
    );

  /**
   * @example export const endpointTags = { "get /v1/user/retrieve": ["users"] }
   * @internal
   * */
  protected makeEndpointTags = () =>
    this.makeConst(
      "endpointTags",
      this.f.createObjectLiteralExpression(
        Array.from(this.tags).map(([request, tags]) =>
          this.f.createPropertyAssignment(
            this.makePropertyIdentifier(request),
            this.f.createArrayLiteralExpression(
              R.map(this.literally.bind(this), tags),
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
    this.makeType(
      this.#ids.implementationType,
      this.makeFnType(
        {
          [this.#ids.methodParameter.text]: this.methodType.name,
          [this.#ids.pathParameter.text]: this.ts.SyntaxKind.StringKeyword,
          [this.#ids.paramsArgument.text]: this.makeRecordStringAny(),
          [this.#ids.ctxArgument.text]: { optional: true, type: "T" },
        },
        this.makePromise(this.ts.SyntaxKind.AnyKeyword),
      ),
      {
        expose: true,
        params: { T: { init: this.ts.SyntaxKind.UnknownKeyword } },
      },
    );

  /**
   * @example const parseRequest = (request: string) => request.split(/ (.+)/, 2) as [Method, Path];
   * @internal
   * */
  protected makeParseRequestFn = () =>
    this.makeConst(
      this.#ids.parseRequestFn,
      this.makeArrowFn(
        { [this.#ids.requestParameter.text]: this.ts.SyntaxKind.StringKeyword },
        this.f.createAsExpression(
          this.makeCall(this.#ids.requestParameter, propOf<string>("split"))(
            this.f.createRegularExpressionLiteral("/ (.+)/"), // split once
            this.literally(2), // excludes third empty element
          ),
          this.f.createTupleTypeNode([
            this.ensureTypeNode(this.methodType.name),
            this.ensureTypeNode(this.#ids.pathType),
          ]),
        ),
      ),
    );

  /**
   * @example const substitute = (path: string, params: Record<string, any>) => { ___ return [path, rest] as const; }
   * @internal
   * */
  protected makeSubstituteFn = () =>
    this.makeConst(
      this.#ids.substituteFn,
      this.makeArrowFn(
        {
          [this.#ids.pathParameter.text]: this.ts.SyntaxKind.StringKeyword,
          [this.#ids.paramsArgument.text]: this.makeRecordStringAny(),
        },
        this.f.createBlock([
          this.makeConst(
            this.#ids.restConst,
            this.f.createObjectLiteralExpression([
              this.f.createSpreadAssignment(this.#ids.paramsArgument),
            ]),
          ),
          this.f.createForInStatement(
            this.f.createVariableDeclarationList(
              [this.f.createVariableDeclaration(this.#ids.keyParameter)],
              this.ts.NodeFlags.Const,
            ),
            this.#ids.paramsArgument,
            this.f.createBlock([
              this.makeAssignment(
                this.#ids.pathParameter,
                this.makeCall(
                  this.#ids.pathParameter,
                  propOf<string>("replace"),
                )(
                  this.makeTemplate(":", [this.#ids.keyParameter]), // `:${key}`
                  this.makeArrowFn(
                    [],
                    this.f.createBlock([
                      this.f.createExpressionStatement(
                        this.f.createDeleteExpression(
                          this.f.createElementAccessExpression(
                            this.#ids.restConst,
                            this.#ids.keyParameter,
                          ),
                        ),
                      ),
                      this.f.createReturnStatement(
                        this.f.createElementAccessExpression(
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
          this.f.createReturnStatement(
            this.f.createAsExpression(
              this.f.createArrayLiteralExpression([
                this.#ids.pathParameter,
                this.#ids.restConst,
              ]),
              this.ensureTypeNode("const"),
            ),
          ),
        ]),
      ),
    );

  // public provide<K extends MethodPath>(request: K, params: Input[K]): Promise<Response[K]> {}
  #makeProvider = () =>
    this.makePublicMethod(
      this.#ids.provideMethod,
      this.makeParams({
        [this.#ids.requestParameter.text]: "K",
        [this.#ids.paramsArgument.text]: this.makeIndexed(
          this.interfaces.input,
          "K",
        ),
        [this.#ids.ctxArgument.text]: { optional: true, type: "T" },
      }),
      [
        this.makeConst(
          // const [method, path] = this.parseRequest(request);
          this.makeDeconstruction(
            this.#ids.methodParameter,
            this.#ids.pathParameter,
          ),
          this.makeCall(this.#ids.parseRequestFn)(this.#ids.requestParameter),
        ),
        // return this.implementation(___)
        this.f.createReturnStatement(
          this.makeCall(this.f.createThis(), this.#ids.implementationArgument)(
            this.#ids.methodParameter,
            this.f.createSpreadElement(
              this.makeCall(this.#ids.substituteFn)(
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
        returns: this.makePromise(
          this.makeIndexed(this.interfaces.response, "K"),
        ),
      },
    );

  /**
   * @example export class Client { ___ }
   * @internal
   * */
  protected makeClientClass = (name: string) =>
    this.makePublicClass(
      name,
      [
        // public constructor(protected readonly implementation: Implementation = defaultImplementation) {}
        this.makePublicConstructor([
          this.makeParam(this.#ids.implementationArgument, {
            type: this.ensureTypeNode(this.#ids.implementationType, ["T"]),
            mod: this.accessModifiers.protectedReadonly,
            init: this.#ids.defaultImplementationConst,
          }),
        ]),
        this.#makeProvider(),
      ],
      { typeParams: ["T"] },
    );

  // `?${new URLSearchParams(____)}`
  #makeSearchParams = (from: ts.Expression) =>
    this.makeTemplate("?", [this.makeNew(URLSearchParams.name, from)]);

  // new URL(`${path}${searchParams}`, "http:____")
  #makeFetchURL = () =>
    this.makeNew(
      URL.name,
      this.makeTemplate(
        "",
        [this.#ids.pathParameter],
        [this.#ids.searchParamsConst],
      ),
      this.literally(this.serverUrl),
    );

  /**
   * @example export const defaultImplementation: Implementation = async (method,path,params) => { ___ };
   * @internal
   * */
  protected makeDefaultImplementation = () => {
    // method: method.toUpperCase()
    const methodProperty = this.f.createPropertyAssignment(
      propOf<RequestInit>("method"),
      this.makeCall(this.#ids.methodParameter, propOf<string>("toUpperCase"))(),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = this.f.createPropertyAssignment(
      propOf<RequestInit>("headers"),
      this.makeTernary(
        this.#ids.hasBodyConst,
        this.f.createObjectLiteralExpression([
          this.f.createPropertyAssignment(
            this.literally("Content-Type"),
            this.literally(contentTypes.json),
          ),
        ]),
        this.#ids.undefinedValue,
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = this.f.createPropertyAssignment(
      propOf<RequestInit>("body"),
      this.makeTernary(
        this.#ids.hasBodyConst,
        this.makeCall(
          JSON[Symbol.toStringTag],
          propOf<JSON>("stringify"),
        )(this.#ids.paramsArgument),
        this.#ids.undefinedValue,
      ),
    );

    // const response = await fetch(new URL(`${path}${searchParams}`, "https://example.com"), { ___ });
    const responseStatement = this.makeConst(
      this.#ids.responseConst,
      this.f.createAwaitExpression(
        this.makeCall(fetch.name)(
          this.#makeFetchURL(),
          this.f.createObjectLiteralExpression([
            methodProperty,
            headersProperty,
            bodyProperty,
          ]),
        ),
      ),
    );

    // const hasBody = !["get", "delete"].includes(method);
    const hasBodyStatement = this.makeConst(
      this.#ids.hasBodyConst,
      this.f.createLogicalNot(
        this.makeCall(
          this.f.createArrayLiteralExpression([
            this.literally("get" satisfies ClientMethod),
            this.literally("head" satisfies ClientMethod),
            this.literally("delete" satisfies ClientMethod),
          ]),
          propOf<string[]>("includes"),
        )(this.#ids.methodParameter),
      ),
    );

    // const searchParams = hasBody ? "" : ___;
    const searchParamsStatement = this.makeConst(
      this.#ids.searchParamsConst,
      this.makeTernary(
        this.#ids.hasBodyConst,
        this.literally(""),
        this.#makeSearchParams(this.#ids.paramsArgument),
      ),
    );

    // const contentType = response.headers.get("content-type");
    const contentTypeStatement = this.makeConst(
      this.#ids.contentTypeConst,
      this.makeCall(
        this.#ids.responseConst,
        propOf<Response>("headers"),
        propOf<Headers>("get"),
      )(this.literally("content-type")),
    );

    // if (!contentType) return;
    const noBodyStatement = this.f.createIfStatement(
      this.f.createPrefixUnaryExpression(
        this.ts.SyntaxKind.ExclamationToken,
        this.#ids.contentTypeConst,
      ),
      this.f.createReturnStatement(),
    );

    // const isJSON = contentType.startsWith("application/json");
    const isJsonConst = this.makeConst(
      this.#ids.isJsonConst,
      this.makeCall(
        this.#ids.contentTypeConst,
        propOf<string>("startsWith"),
      )(this.literally(contentTypes.json)),
    );

    // return response[isJSON ? "json" : "text"]();
    const returnStatement = this.f.createReturnStatement(
      this.makeCall(
        this.#ids.responseConst,
        this.makeTernary(
          this.#ids.isJsonConst,
          this.literally(propOf<Response>("json")),
          this.literally(propOf<Response>("text")),
        ),
      )(),
    );

    return this.makeConst(
      this.#ids.defaultImplementationConst,
      this.makeArrowFn(
        [
          this.#ids.methodParameter,
          this.#ids.pathParameter,
          this.#ids.paramsArgument,
        ],
        this.f.createBlock([
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
    this.makePublicConstructor(
      this.makeParams({
        request: "K",
        params: this.makeIndexed(this.interfaces.input, "K"),
      }),
      [
        this.makeConst(
          this.makeDeconstruction(this.#ids.pathParameter, this.#ids.restConst),
          this.makeCall(this.#ids.substituteFn)(
            this.f.createElementAccessExpression(
              this.makeCall(this.#ids.parseRequestFn)(
                this.#ids.requestParameter,
              ),
              this.literally(1),
            ),
            this.#ids.paramsArgument,
          ),
        ),
        this.makeConst(
          this.#ids.searchParamsConst,
          this.#makeSearchParams(this.#ids.restConst),
        ),
        this.makeAssignment(
          this.f.createPropertyAccessExpression(
            this.f.createThis(),
            this.#ids.sourceProp,
          ),
          this.makeNew("EventSource", this.#makeFetchURL()),
        ),
      ],
    );

  #makeEventNarrow = (value: Typeable) =>
    this.f.createTypeLiteralNode([
      this.makeInterfaceProp(propOf<SSEShape>("event"), value),
    ]);

  #makeOnMethod = () =>
    this.makePublicMethod(
      this.#ids.onMethod,
      this.makeParams({
        [this.#ids.eventParameter.text]: "E",
        [this.#ids.handlerParameter.text]: this.makeFnType(
          {
            [this.#ids.dataParameter.text]: this.makeIndexed(
              this.makeExtract(
                "R",
                this.makeOneLine(this.#makeEventNarrow("E")),
              ),
              this.makeLiteralType(propOf<SSEShape>("data")),
            ),
          },
          this.makeMaybeAsync(this.ts.SyntaxKind.VoidKeyword),
        ),
      }),
      [
        this.f.createExpressionStatement(
          this.makeCall(
            this.f.createThis(),
            this.#ids.sourceProp,
            propOf<EventSource>("addEventListener"),
          )(
            this.#ids.eventParameter,
            this.makeArrowFn(
              [this.#ids.msgParameter],
              this.makeCall(this.#ids.handlerParameter)(
                this.makeCall(
                  JSON[Symbol.toStringTag],
                  propOf<JSON>("parse"),
                )(
                  this.f.createPropertyAccessExpression(
                    this.f.createParenthesizedExpression(
                      this.f.createAsExpression(
                        this.#ids.msgParameter,
                        this.ensureTypeNode(MessageEvent.name),
                      ),
                    ),
                    propOf<SSEShape>("data"),
                  ),
                ),
              ),
            ),
          ),
        ),
        this.f.createReturnStatement(this.f.createThis()),
      ],
      {
        typeParams: {
          E: this.makeIndexed(
            "R",
            this.makeLiteralType(propOf<SSEShape>("event")),
          ),
        },
      },
    );

  /**
   * @example export class Subscription<K extends Extract<___>, R extends Extract<___>> { ___ }
   * @internal
   * */
  protected makeSubscriptionClass = (name: string) =>
    this.makePublicClass(
      name,
      [
        this.makePublicProperty(this.#ids.sourceProp, "EventSource"),
        this.#makeSubscriptionConstructor(),
        this.#makeOnMethod(),
      ],
      {
        typeParams: {
          K: this.makeExtract(
            this.requestType.name,
            this.f.createTemplateLiteralType(
              this.f.createTemplateHead("get "),
              [
                this.f.createTemplateLiteralTypeSpan(
                  this.ensureTypeNode(this.ts.SyntaxKind.StringKeyword),
                  this.f.createTemplateTail(""),
                ),
              ],
            ),
          ),
          R: this.makeExtract(
            this.makeIndexed(this.interfaces.positive, "K"),
            this.makeOneLine(
              this.#makeEventNarrow(this.ts.SyntaxKind.StringKeyword),
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
    this.makeConst(this.#ids.clientConst, this.makeNew(clientClassName)), // const client = new Client();
    // client.provide("get /v1/user/retrieve", { id: "10" });
    this.makeCall(this.#ids.clientConst, this.#ids.provideMethod)(
      this.literally(`${"get" satisfies ClientMethod} /v1/user/retrieve`),
      this.f.createObjectLiteralExpression([
        this.f.createPropertyAssignment("id", this.literally("10")),
      ]),
    ),
    // new Subscription("get /v1/events/stream", {}).on("time", (time) => {});
    this.makeCall(
      this.makeNew(
        subscriptionClassName,
        this.literally(`${"get" satisfies ClientMethod} /v1/events/stream`),
        this.f.createObjectLiteralExpression(),
      ),
      this.#ids.onMethod,
    )(
      this.literally("time"),
      this.makeArrowFn(["time"], this.f.createBlock([])),
    ),
  ];
}
