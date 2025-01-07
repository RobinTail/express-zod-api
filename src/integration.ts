import { chain } from "ramda";
import ts from "typescript";
import { z } from "zod";
import { ResponseVariant, responseVariants } from "./api-response";
import {
  f,
  makePromise,
  makeArrowFn,
  makeConst,
  makeDeconstruction,
  makeEmptyInitializingConstructor,
  makeInterfaceProp,
  makeObjectKeysReducer,
  makeParam,
  makeParams,
  makePropCall,
  makePublicClass,
  makeInterface,
  makePublicLiteralType,
  makePublicMethod,
  makeType,
  makeTernary,
  propOf,
  protectedReadonlyModifier,
  recordStringAny,
  makeAnd,
  makeTemplate,
  makeNew,
  makeKeyOf,
  makeSomeOfHelper,
  makePropertyIdentifier,
  printNode,
} from "./typescript-api";
import { makeCleanId } from "./common-helpers";
import { Method, methods } from "./method";
import { contentTypes } from "./content-type";
import { loadPeer } from "./peer-helpers";
import { Routing } from "./routing";
import { OnEndpoint, walkRouting } from "./routing-walker";
import { HandlingRules } from "./schema-walker";
import { zodToTs } from "./zts";
import { ZTSContext } from "./zts-helpers";
import type Prettier from "prettier";

type IOKind = "input" | "response" | ResponseVariant | "encoded";

interface IntegrationParams {
  routing: Routing;
  /**
   * @desc What should be generated
   * @example "types" — types of your endpoint requests and responses (for a DIY solution)
   * @example "client" — an entity for performing typed requests and receiving typed responses
   * @default "client"
   * */
  variant?: "types" | "client";
  /**
   * @desc The API URL to use in the generated code
   * @default https://example.com
   * */
  serverUrl?: string;
  /**
   * @desc configures the style of object's optional properties
   * @default { withQuestionMark: true, withUndefined: true }
   */
  optionalPropStyle?: {
    /**
     * @desc add question mark to the optional property definition
     * @example { someProp?: boolean }
     * */
    withQuestionMark?: boolean;
    /**
     * @desc add undefined to the property union type
     * @example { someProp: boolean | undefined }
     */
    withUndefined?: boolean;
  };
  /**
   * @desc The schema to use for responses without body such as 204
   * @default z.undefined()
   * */
  noContent?: z.ZodTypeAny;
  /**
   * @desc Handling rules for your own branded schemas.
   * @desc Keys: brands (recommended to use unique symbols).
   * @desc Values: functions having schema as first argument that you should assign type to, second one is a context.
   * @example { MyBrand: ( schema: typeof myBrandSchema, { next } ) => createKeywordTypeNode(SyntaxKind.AnyKeyword)
   */
  brandHandling?: HandlingRules<ts.TypeNode, ZTSContext>;
}

interface FormattedPrintingOptions {
  /** @desc Typescript printer options */
  printerOptions?: ts.PrinterOptions;
  /**
   * @desc Typescript code formatter
   * @default prettier.format
   * */
  format?: (program: string) => Promise<string>;
}

export class Integration {
  protected someOf = makeSomeOfHelper();
  protected program: ts.Node[] = [this.someOf];
  protected usage: Array<ts.Node | string> = [];
  protected registry = new Map<
    string, // request (method+path)
    Record<IOKind, ts.TypeNode> & { tags: ReadonlyArray<string> }
  >();
  protected paths = new Set<string>();
  protected aliases = new Map<z.ZodTypeAny, ts.TypeAliasDeclaration>();
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
    props: ts.PropertySignature[];
  }> = [];

  protected makeAlias(
    schema: z.ZodTypeAny,
    produce: () => ts.TypeNode,
  ): ts.TypeReferenceNode {
    let name = this.aliases.get(schema)?.name?.text;
    if (!name) {
      name = `Type${this.aliases.size + 1}`;
      const temp = f.createLiteralTypeNode(f.createNull());
      this.aliases.set(schema, makeType(name, temp));
      this.aliases.set(schema, makeType(name, produce()));
    }
    return f.createTypeReferenceNode(name);
  }

  /** @example SomeOf<_>*/
  protected makeSomeOf = ({ name }: ts.TypeAliasDeclaration) =>
    f.createTypeReferenceNode(this.someOf.name, [
      f.createTypeReferenceNode(name),
    ]);

  public constructor({
    routing,
    brandHandling,
    variant = "client",
    serverUrl = "https://example.com",
    optionalPropStyle = { withQuestionMark: true, withUndefined: true },
    noContent = z.undefined(),
  }: IntegrationParams) {
    const commons = { makeAlias: this.makeAlias.bind(this), optionalPropStyle };
    const ctxIn = { brandHandling, ctx: { ...commons, isResponse: false } };
    const ctxOut = { brandHandling, ctx: { ...commons, isResponse: true } };
    const onEndpoint: OnEndpoint = (endpoint, path, method) => {
      const entitle = makeCleanId.bind(null, method, path); // clean id with method+path prefix
      const request = `${method} ${path}`;
      const input = makeType(
        entitle("input"),
        zodToTs(endpoint.getSchema("input"), ctxIn),
        { comment: request },
      );
      this.program.push(input);
      const dictionaries = responseVariants.reduce(
        (agg, responseVariant) => {
          const responses = endpoint.getResponses(responseVariant);
          const props = chain(([idx, { schema, mimeTypes, statusCodes }]) => {
            const variantType = makeType(
              entitle(responseVariant, "variant", `${idx + 1}`),
              zodToTs(mimeTypes ? schema : noContent, ctxOut),
              { comment: request },
            );
            this.program.push(variantType);
            return statusCodes.map((code) =>
              makeInterfaceProp(
                code,
                f.createTypeReferenceNode(variantType.name),
              ),
            );
          }, Array.from(responses.entries()));
          const dict = makeInterface(
            entitle(responseVariant, "response", "variants"),
            props,
            { comment: request },
          );
          this.program.push(dict);
          return Object.assign(agg, { [responseVariant]: dict });
        },
        {} as Record<ResponseVariant, ts.TypeAliasDeclaration>,
      );
      this.paths.add(path);
      const literalIdx = f.createLiteralTypeNode(
        f.createStringLiteral(request),
      );
      this.registry.set(request, {
        input: f.createTypeReferenceNode(input.name),
        positive: this.makeSomeOf(dictionaries.positive),
        negative: this.makeSomeOf(dictionaries.negative),
        response: f.createUnionTypeNode([
          f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(this.ids.posResponseInterface),
            literalIdx,
          ),
          f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(this.ids.negResponseInterface),
            literalIdx,
          ),
        ]),
        encoded: f.createIntersectionTypeNode([
          f.createTypeReferenceNode(dictionaries.positive.name),
          f.createTypeReferenceNode(dictionaries.negative.name),
        ]),
        tags: endpoint.getTags(),
      });
    };
    walkRouting({ routing, onEndpoint });
    this.program.unshift(...this.aliases.values());

    // export type Path = "/v1/user/retrieve" | ___;
    this.program.push(
      makePublicLiteralType(this.ids.pathType, Array.from(this.paths)),
    );

    // export type Method = "get" | "post" | "put" | "delete" | "patch";
    this.program.push(makePublicLiteralType(this.ids.methodType, methods));

    this.interfaces.push(
      {
        id: this.ids.inputInterface,
        kind: "input",
        props: [],
      },
      { id: this.ids.posResponseInterface, kind: "positive", props: [] },
      { id: this.ids.negResponseInterface, kind: "negative", props: [] },
      { id: this.ids.encResponseInterface, kind: "encoded", props: [] },
      {
        id: this.ids.responseInterface,
        kind: "response",
        props: [],
      },
    );

    // Single walk through the registry for making properties for the next three objects
    const endpointTags: ts.PropertyAssignment[] = [];
    for (const [request, { tags, ...rest }] of this.registry) {
      // "get /v1/user/retrieve": GetV1UserRetrieveInput
      for (const face of this.interfaces)
        face.props.push(makeInterfaceProp(request, rest[face.kind]));
      if (variant !== "types") {
        // "get /v1/user/retrieve": ["users"]
        endpointTags.push(
          f.createPropertyAssignment(
            makePropertyIdentifier(request),
            f.createArrayLiteralExpression(
              tags.map((tag) => f.createStringLiteral(tag)),
            ),
          ),
        );
      }
    }

    // export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
    for (const { id, props } of this.interfaces)
      this.program.push(makeInterface(id, props, { expose: true }));

    // export type Request = keyof Input;
    this.program.push(
      makeType(this.ids.requestType, makeKeyOf(this.ids.inputInterface), {
        expose: true,
      }),
    );

    if (variant === "types") return;

    // export const endpointTags = { "get /v1/user/retrieve": ["users"] }
    const endpointTagsConst = makeConst(
      this.ids.endpointTagsConst,
      f.createObjectLiteralExpression(endpointTags),
      { expose: true },
    );

    // export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
    const implementationType = makeType(
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

    // public provide<K extends MethodPath>(request: K, params: Input[K]): Promise<Response[K]> {
    const providerMethod = makePublicMethod(
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

    // export class ExpressZodAPIClient { ___ }
    const clientClass = makePublicClass(
      this.ids.clientClass,
      // constructor(protected readonly implementation: Implementation) {}
      makeEmptyInitializingConstructor([
        makeParam(
          this.ids.implementationArgument,
          f.createTypeReferenceNode(this.ids.implementationType),
          protectedReadonlyModifier,
        ),
      ]),
      [providerMethod],
    );

    this.program.push(endpointTagsConst, implementationType, clientClass);

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
        makePropCall(f.createIdentifier("JSON"), propOf<JSON>("stringify"), [
          this.ids.paramsArgument,
        ]),
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
            f.createStringLiteral(serverUrl),
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
      f.createReturnStatement(undefined),
      undefined,
    );

    // const isJSON = contentType.startsWith("application/json");
    const parserStatement = makeConst(
      this.ids.isJsonConst,
      f.createCallChain(
        f.createPropertyAccessChain(
          this.ids.contentTypeConst,
          undefined,
          propOf<string>("startsWith"),
        ),
        undefined,
        undefined,
        [f.createStringLiteral(contentTypes.json)],
      ),
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

    // export const exampleImplementation: Implementation = async (method,path,params) => { ___ };
    const exampleImplStatement = makeConst(
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
          parserStatement,
          returnStatement,
        ]),
        { isAsync: true },
      ),
      {
        expose: true,
        type: f.createTypeReferenceNode(this.ids.implementationType),
      },
    );

    // client.provide("get /v1/user/retrieve", { id: "10" });
    const provideCallingStatement = f.createExpressionStatement(
      makePropCall(this.ids.clientConst, this.ids.provideMethod, [
        f.createStringLiteral(`${"get" satisfies Method} /v1/user/retrieve`),
        f.createObjectLiteralExpression([
          f.createPropertyAssignment("id", f.createStringLiteral("10")),
        ]),
      ]),
    );

    // const client = new ExpressZodAPIClient(exampleImplementation);
    const clientInstanceStatement = makeConst(
      this.ids.clientConst,
      makeNew(this.ids.clientClass, this.ids.exampleImplementationConst),
    );

    this.usage.push(
      exampleImplStatement,
      clientInstanceStatement,
      provideCallingStatement,
    );
  }

  protected printUsage(printerOptions?: ts.PrinterOptions) {
    return this.usage.length
      ? this.usage
          .map((entry) =>
            typeof entry === "string"
              ? entry
              : printNode(entry, printerOptions),
          )
          .join("\n")
      : undefined;
  }

  public print(printerOptions?: ts.PrinterOptions) {
    const usageExampleText = this.printUsage(printerOptions);
    const commentNode =
      usageExampleText &&
      ts.addSyntheticLeadingComment(
        ts.addSyntheticLeadingComment(
          f.createEmptyStatement(),
          ts.SyntaxKind.SingleLineCommentTrivia,
          " Usage example:",
        ),
        ts.SyntaxKind.MultiLineCommentTrivia,
        `\n${usageExampleText}`,
      );
    return this.program
      .concat(commentNode || [])
      .map((node, index) =>
        printNode(
          node,
          index < this.program.length
            ? printerOptions
            : { ...printerOptions, omitTrailingSemicolon: true },
        ),
      )
      .join("\n\n");
  }

  public async printFormatted({
    printerOptions,
    format: userDefined,
  }: FormattedPrintingOptions = {}) {
    let format = userDefined;
    if (!format) {
      try {
        const prettierFormat = (await loadPeer<typeof Prettier>("prettier"))
          .format;
        format = (text) => prettierFormat(text, { filepath: "client.ts" });
      } catch {}
    }

    const usageExample = this.printUsage(printerOptions);
    this.usage =
      usageExample && format ? [await format(usageExample)] : this.usage;

    const output = this.print(printerOptions);
    return format ? format(output) : output;
  }
}
