import ts from "typescript";
import { ResponseVariant } from "./api-response";
import { contentTypes } from "./content-type";
import { Method, methods } from "./method";
import {
  f,
  makeAnd,
  makeArrowFn,
  makeConst,
  makeDeconstruction,
  makeEmptyInitializingConstructor,
  makeInterface,
  makeInterfaceProp,
  makeKeyOf,
  makeNew,
  makeObjectKeysReducer,
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
  protectedReadonlyModifier,
  recordStringAny,
} from "./typescript-api";

type IOKind = "input" | "response" | ResponseVariant | "encoded";

export abstract class IntegrationBase {
  protected paths = new Set<string>();
  protected tags = new Map<string, ReadonlyArray<string>>();
  protected registry = new Map<string, Record<IOKind, ts.TypeNode>>();

  protected ids = {
    pathType: f.createIdentifier("Path"),
    methodType: f.createIdentifier("Method"),
    requestType: f.createIdentifier("Request"),
    inputInterface: f.createIdentifier("Input"),
    posResponseInterface: f.createIdentifier("PositiveResponse"),
    negResponseInterface: f.createIdentifier("NegativeResponse"),
    encResponseInterface: f.createIdentifier("EncodedResponse"),
    responseInterface: f.createIdentifier("Response"),
    endpointTagsConst: f.createIdentifier("endpointTags"),
    implementationType: f.createIdentifier("Implementation"),
    clientClass: f.createIdentifier("ExpressZodAPIClient"),
    keyParameter: f.createIdentifier("key"),
    pathParameter: f.createIdentifier("path"),
    paramsArgument: f.createIdentifier("params"),
    methodParameter: f.createIdentifier("method"),
    requestParameter: f.createIdentifier("request"),
    accumulator: f.createIdentifier("acc"),
    provideMethod: f.createIdentifier("provide"),
    implementationArgument: f.createIdentifier("implementation"),
    headersProperty: f.createIdentifier("headers"),
    hasBodyConst: f.createIdentifier("hasBody"),
    undefinedValue: f.createIdentifier("undefined"),
    bodyProperty: f.createIdentifier("body"),
    responseConst: f.createIdentifier("response"),
    searchParamsConst: f.createIdentifier("searchParams"),
    exampleImplementationConst: f.createIdentifier("exampleImplementation"),
    clientConst: f.createIdentifier("client"),
    contentTypeConst: f.createIdentifier("contentType"),
    isJsonConst: f.createIdentifier("isJSON"),
  } satisfies Record<string, ts.Identifier>;

  protected interfaces: Array<{
    id: ts.Identifier;
    kind: IOKind;
  }> = [
    { id: this.ids.inputInterface, kind: "input" },
    { id: this.ids.posResponseInterface, kind: "positive" },
    { id: this.ids.negResponseInterface, kind: "negative" },
    { id: this.ids.encResponseInterface, kind: "encoded" },
    { id: this.ids.responseInterface, kind: "response" },
  ];

  protected constructor(private readonly serverUrl: string) {}

  // export type Method = "get" | "post" | "put" | "delete" | "patch";
  protected methodType = makePublicLiteralType(this.ids.methodType, methods);

  // type SomeOf<T> = T[keyof T];
  protected someOfType = makeType(
    "SomeOf",
    f.createIndexedAccessTypeNode(
      f.createTypeReferenceNode("T"),
      makeKeyOf("T"),
    ),
    { params: { T: undefined } },
  );

  // export type Request = keyof Input;
  protected requestType = makeType(
    this.ids.requestType,
    makeKeyOf(this.ids.inputInterface),
    { expose: true },
  );

  /** @example SomeOf<_>*/
  protected someOf = ({ name }: ts.TypeAliasDeclaration) =>
    f.createTypeReferenceNode(this.someOfType.name, [
      f.createTypeReferenceNode(name),
    ]);

  // export type Path = "/v1/user/retrieve" | ___;
  protected makePathType = () =>
    makePublicLiteralType(this.ids.pathType, Array.from(this.paths));

  // export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
  protected makePublicInterfaces = () =>
    this.interfaces.map(({ id, kind }) =>
      makeInterface(
        id,
        Array.from(this.registry).map(([request, faces]) =>
          makeInterfaceProp(request, faces[kind]),
        ),
        { expose: true },
      ),
    );

  // export const endpointTags = { "get /v1/user/retrieve": ["users"] }
  protected makeEndpointTags = () =>
    makeConst(
      this.ids.endpointTagsConst,
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
          [this.ids.methodParameter.text]: f.createTypeReferenceNode(
            this.ids.methodType,
          ),
          [this.ids.pathParameter.text]: f.createKeywordTypeNode(
            ts.SyntaxKind.StringKeyword,
          ),
          [this.ids.paramsArgument.text]: recordStringAny,
        }),
        makePromise("any"),
      ),
      { expose: true },
    );

  // public provide<K extends MethodPath>(request: K, params: Input[K]): Promise<Response[K]> {}
  private makeProvider = () => {
    // `:${key}`
    const keyParamExpression = makeTemplate(":", [this.ids.keyParameter]);

    // Object.keys(params).reduce((acc, key) => acc.replace(___, params[key]), path)
    const pathArgument = makeObjectKeysReducer(
      this.ids.paramsArgument,
      makePropCall(this.ids.accumulator, propOf<string>("replace"), [
        keyParamExpression,
        f.createElementAccessExpression(
          f.createAsExpression(this.ids.paramsArgument, recordStringAny),
          this.ids.keyParameter,
        ),
      ]),
      this.ids.pathParameter,
    );

    // Object.keys(params).reduce((acc, key) =>
    //   Object.assign(acc, !path.includes(`:${key}`) && {[key]: params[key]} ), {})
    const paramsArgument = makeObjectKeysReducer(
      this.ids.paramsArgument,
      makePropCall(
        f.createIdentifier(Object.name),
        propOf<typeof Object>("assign"),
        [
          this.ids.accumulator,
          makeAnd(
            f.createPrefixUnaryExpression(
              ts.SyntaxKind.ExclamationToken,
              makePropCall(this.ids.pathParameter, propOf<string>("includes"), [
                keyParamExpression,
              ]),
            ),
            f.createObjectLiteralExpression(
              [
                f.createPropertyAssignment(
                  f.createComputedPropertyName(this.ids.keyParameter),
                  f.createElementAccessExpression(
                    f.createAsExpression(
                      this.ids.paramsArgument,
                      recordStringAny,
                    ),
                    this.ids.keyParameter,
                  ),
                ),
              ],
              false,
            ),
          ),
        ],
      ),
      f.createObjectLiteralExpression(),
    );

    return makePublicMethod(
      this.ids.provideMethod,
      makeParams({
        [this.ids.requestParameter.text]: f.createTypeReferenceNode("K"),
        [this.ids.paramsArgument.text]: f.createIndexedAccessTypeNode(
          f.createTypeReferenceNode(this.ids.inputInterface),
          f.createTypeReferenceNode("K"),
        ),
      }),
      f.createBlock([
        makeConst(
          // const [method, path, params] =
          makeDeconstruction(this.ids.methodParameter, this.ids.pathParameter),
          // request.split(/ (.+)/, 2) as [Method, Path];
          f.createAsExpression(
            makePropCall(this.ids.requestParameter, propOf<string>("split"), [
              f.createRegularExpressionLiteral("/ (.+)/"), // split once
              f.createNumericLiteral(2), // excludes third empty element
            ]),
            f.createTupleTypeNode([
              f.createTypeReferenceNode(this.ids.methodType),
              f.createTypeReferenceNode(this.ids.pathType),
            ]),
          ),
        ),
        // return this.implementation(___)
        f.createReturnStatement(
          makePropCall(f.createThis(), this.ids.implementationArgument, [
            this.ids.methodParameter,
            pathArgument,
            paramsArgument,
          ]),
        ),
      ]),
      {
        typeParams: { K: this.ids.requestType },
        returns: makePromise(
          f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(this.ids.responseInterface),
            f.createTypeReferenceNode("K"),
          ),
        ),
      },
    );
  };

  // export class ExpressZodAPIClient { ___ }
  protected makeClientClass = () =>
    makePublicClass(
      this.ids.clientClass,
      // constructor(protected readonly implementation: Implementation) {}
      makeEmptyInitializingConstructor([
        makeParam(
          this.ids.implementationArgument,
          f.createTypeReferenceNode(this.ids.implementationType),
          protectedReadonlyModifier,
        ),
      ]),
      [this.makeProvider()],
    );

  // export const exampleImplementation: Implementation = async (method,path,params) => { ___ };
  protected makeExampleImplementation = () => {
    // method: method.toUpperCase()
    const methodProperty = f.createPropertyAssignment(
      this.ids.methodParameter,
      makePropCall(this.ids.methodParameter, propOf<string>("toUpperCase")),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = f.createPropertyAssignment(
      this.ids.headersProperty,
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
      this.ids.bodyProperty,
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
        [this.ids.responseConst, this.ids.headersProperty],
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
      this.ids.exampleImplementationConst,
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
      {
        expose: true,
        type: f.createTypeReferenceNode(this.ids.implementationType),
      },
    );
  };

  protected makeUsageStatements = () => [
    // const client = new ExpressZodAPIClient(exampleImplementation);
    makeConst(
      this.ids.clientConst,
      makeNew(this.ids.clientClass, this.ids.exampleImplementationConst),
    ),
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
