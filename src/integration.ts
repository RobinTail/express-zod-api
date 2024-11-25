import ts from "typescript";
import { z } from "zod";
import { ResponseVariant } from "./api-response";
import {
  emptyTail,
  exportModifier,
  f,
  makePromiseAny,
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
  makePublicInterface,
  makePublicLiteralType,
  makePublicMethod,
  makePublicType,
  makeTernary,
  makeTypeParams,
  propOf,
  protectedReadonlyModifier,
  quoteProp,
  recordStringAny,
  makeAnd,
} from "./integration-helpers";
import { makeCleanId } from "./common-helpers";
import { Method, methods } from "./method";
import { contentTypes } from "./content-type";
import { loadPeer } from "./peer-helpers";
import { Routing } from "./routing";
import { walkRouting } from "./routing-walker";
import { HandlingRules } from "./schema-walker";
import { zodToTs } from "./zts";
import { ZTSContext, createTypeAlias, printNode } from "./zts-helpers";
import type Prettier from "prettier";

type IOKind = "input" | "response" | ResponseVariant;

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
   * @desc Declares positive and negative response types separately and provides them within additional dictionaries
   * @default false
   * */
  splitResponse?: boolean;
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
  protected program: ts.Node[] = [];
  protected usage: Array<ts.Node | string> = [];
  protected registry = new Map<
    { method: Method; path: string },
    Partial<Record<IOKind, string>> & {
      isJson: boolean;
      tags: ReadonlyArray<string>;
    }
  >();
  protected paths: string[] = [];
  protected aliases = new Map<z.ZodTypeAny, ts.TypeAliasDeclaration>();
  protected ids = {
    pathType: f.createIdentifier("Path"),
    methodType: f.createIdentifier("Method"),
    methodPathType: f.createIdentifier("MethodPath"),
    inputInterface: f.createIdentifier("Input"),
    posResponseInterface: f.createIdentifier("PositiveResponse"),
    negResponseInterface: f.createIdentifier("NegativeResponse"),
    responseInterface: f.createIdentifier("Response"),
    jsonEndpointsConst: f.createIdentifier("jsonEndpoints"),
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
      this.aliases.set(schema, createTypeAlias(temp, name));
      this.aliases.set(schema, createTypeAlias(produce(), name));
    }
    return f.createTypeReferenceNode(name);
  }

  public constructor({
    routing,
    brandHandling,
    variant = "client",
    splitResponse = false,
    optionalPropStyle = { withQuestionMark: true, withUndefined: true },
    noContent = z.undefined(),
  }: IntegrationParams) {
    walkRouting({
      routing,
      onEndpoint: (endpoint, path, method) => {
        const commons = {
          makeAlias: this.makeAlias.bind(this),
          optionalPropStyle,
        };
        const inputId = makeCleanId(method, path, "input");
        const input = zodToTs(endpoint.getSchema("input"), {
          brandHandling,
          ctx: { ...commons, isResponse: false },
        });
        const positiveResponseId = splitResponse
          ? makeCleanId(method, path, "positive.response")
          : undefined;
        const positiveSchema = endpoint
          .getResponses("positive")
          .map(({ schema, mimeTypes }) => (mimeTypes ? schema : noContent))
          .reduce((agg, schema) => agg.or(schema));
        const positiveResponse = splitResponse
          ? zodToTs(positiveSchema, {
              brandHandling,
              ctx: { ...commons, isResponse: true },
            })
          : undefined;
        const negativeResponseId = splitResponse
          ? makeCleanId(method, path, "negative.response")
          : undefined;
        const negativeSchema = endpoint
          .getResponses("negative")
          .map(({ schema, mimeTypes }) => (mimeTypes ? schema : noContent))
          .reduce((agg, schema) => agg.or(schema));
        const negativeResponse = splitResponse
          ? zodToTs(negativeSchema, {
              brandHandling,
              ctx: { ...commons, isResponse: true },
            })
          : undefined;
        const genericResponseId = makeCleanId(method, path, "response");
        const genericResponse =
          positiveResponseId && negativeResponseId
            ? f.createUnionTypeNode([
                f.createTypeReferenceNode(positiveResponseId),
                f.createTypeReferenceNode(negativeResponseId),
              ])
            : zodToTs(positiveSchema.or(negativeSchema), {
                brandHandling,
                ctx: { ...commons, isResponse: true },
              });
        this.program.push(createTypeAlias(input, inputId));
        if (positiveResponse && positiveResponseId) {
          this.program.push(
            createTypeAlias(positiveResponse, positiveResponseId),
          );
        }
        if (negativeResponse && negativeResponseId) {
          this.program.push(
            createTypeAlias(negativeResponse, negativeResponseId),
          );
        }
        this.program.push(createTypeAlias(genericResponse, genericResponseId));
        this.paths.push(path);
        this.registry.set(
          { method, path },
          {
            input: inputId,
            positive: positiveResponseId,
            negative: negativeResponseId,
            response: genericResponseId,
            isJson: endpoint
              .getResponses("positive")
              .some((response) =>
                response.mimeTypes?.includes(contentTypes.json),
              ),
            tags: endpoint.getTags(),
          },
        );
      },
    });

    this.program.unshift(...this.aliases.values());

    // export type Path = "/v1/user/retrieve" | ___;
    this.program.push(makePublicLiteralType(this.ids.pathType, this.paths));

    // export type Method = "get" | "post" | "put" | "delete" | "patch";
    this.program.push(makePublicLiteralType(this.ids.methodType, methods));

    this.interfaces.push({
      id: this.ids.inputInterface,
      kind: "input",
      props: [],
    });
    if (splitResponse) {
      this.interfaces.push(
        { id: this.ids.posResponseInterface, kind: "positive", props: [] },
        { id: this.ids.negResponseInterface, kind: "negative", props: [] },
      );
    }
    this.interfaces.push({
      id: this.ids.responseInterface,
      kind: "response",
      props: [],
    });

    // Single walk through the registry for making properties for the next three objects
    const jsonEndpoints: ts.PropertyAssignment[] = [];
    const endpointTags: ts.PropertyAssignment[] = [];
    for (const [{ method, path }, { isJson, tags, ...rest }] of this.registry) {
      const propName = quoteProp(method, path);
      // "get /v1/user/retrieve": GetV1UserRetrieveInput
      for (const face of this.interfaces) {
        if (face.kind in rest)
          face.props.push(makeInterfaceProp(propName, rest[face.kind]!));
      }
      if (variant !== "types") {
        if (isJson) {
          // "get /v1/user/retrieve": true
          jsonEndpoints.push(
            f.createPropertyAssignment(propName, f.createTrue()),
          );
        }
        // "get /v1/user/retrieve": ["users"]
        endpointTags.push(
          f.createPropertyAssignment(
            propName,
            f.createArrayLiteralExpression(
              tags.map((tag) => f.createStringLiteral(tag)),
            ),
          ),
        );
      }
    }

    // export interface Input { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
    for (const { id, props } of this.interfaces)
      this.program.push(makePublicInterface(id, props));

    // export type MethodPath = keyof Input;
    this.program.push(
      makePublicType(
        this.ids.methodPathType,
        f.createTypeOperatorNode(
          ts.SyntaxKind.KeyOfKeyword,
          f.createTypeReferenceNode(this.ids.inputInterface),
        ),
      ),
    );

    if (variant === "types") return;

    // export const jsonEndpoints = { "get /v1/user/retrieve": true }
    const jsonEndpointsConst = f.createVariableStatement(
      exportModifier,
      makeConst(
        this.ids.jsonEndpointsConst,
        f.createObjectLiteralExpression(jsonEndpoints),
      ),
    );

    // export const endpointTags = { "get /v1/user/retrieve": ["users"] }
    const endpointTagsConst = f.createVariableStatement(
      exportModifier,
      makeConst(
        this.ids.endpointTagsConst,
        f.createObjectLiteralExpression(endpointTags),
      ),
    );

    // export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
    const implementationType = makePublicType(
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
        makePromiseAny(),
      ),
    );

    // `:${key}`
    const keyParamExpression = f.createTemplateExpression(
      f.createTemplateHead(":"),
      [f.createTemplateSpan(this.ids.keyParameter, emptyTail)],
    );

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

    // public provide<K extends keyof Input>(request: K, params: Input[K]): Promise<Response[K]> {
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
        f.createVariableStatement(
          undefined,
          makeConst(
            // const [method, path, params] =
            makeDeconstruction(
              this.ids.methodParameter,
              this.ids.pathParameter,
            ),
            // (args.length === 2 ? [...args[0].split((/ (.+)/,2), args[1]] : args) as [Method, Path, Record<string, any>]
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
      makeTypeParams({ K: this.ids.methodPathType }),
      f.createTypeReferenceNode(Promise.name, [
        f.createIndexedAccessTypeNode(
          f.createTypeReferenceNode(this.ids.responseInterface),
          f.createTypeReferenceNode("K"),
        ),
      ]),
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

    this.program.push(
      jsonEndpointsConst,
      endpointTagsConst,
      implementationType,
      clientClass,
    );

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

    // const response = await fetch(`https://example.com${path}${searchParams}`, { ___ });
    const responseStatement = f.createVariableStatement(
      undefined,
      makeConst(
        this.ids.responseConst,
        f.createAwaitExpression(
          f.createCallExpression(f.createIdentifier(fetch.name), undefined, [
            f.createTemplateExpression(
              f.createTemplateHead("https://example.com"),
              [
                f.createTemplateSpan(
                  this.ids.pathParameter,
                  f.createTemplateMiddle(""),
                ),
                f.createTemplateSpan(this.ids.searchParamsConst, emptyTail),
              ],
            ),
            f.createObjectLiteralExpression([
              methodProperty,
              headersProperty,
              bodyProperty,
            ]),
          ]),
        ),
      ),
    );

    // const hasBody = !["get", "delete"].includes(method);
    const hasBodyStatement = f.createVariableStatement(
      undefined,
      makeConst(
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
      ),
    );

    // const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
    const searchParamsStatement = f.createVariableStatement(
      undefined,
      makeConst(
        this.ids.searchParamsConst,
        makeTernary(
          this.ids.hasBodyConst,
          f.createStringLiteral(""),
          f.createTemplateExpression(f.createTemplateHead("?"), [
            f.createTemplateSpan(
              f.createNewExpression(
                f.createIdentifier(URLSearchParams.name),
                undefined,
                [this.ids.paramsArgument],
              ),
              emptyTail,
            ),
          ]),
        ),
      ),
    );

    // const contentType = response.headers.get("content-type");
    const contentTypeStatement = f.createVariableStatement(
      undefined,
      makeConst(
        this.ids.contentTypeConst,
        makePropCall(
          [this.ids.responseConst, this.ids.headersProperty],
          propOf<Headers>("get"),
          [f.createStringLiteral("content-type")],
        ),
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
    const parserStatement = f.createVariableStatement(
      undefined,
      makeConst(
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
    const exampleImplStatement = f.createVariableStatement(
      exportModifier,
      makeConst(
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
          true,
        ),
        f.createTypeReferenceNode(this.ids.implementationType),
      ),
    );

    // client.provide("get", "/v1/user/retrieve", { id: "10" });
    const provideCallingStatement = f.createExpressionStatement(
      makePropCall(this.ids.clientConst, this.ids.provideMethod, [
        f.createStringLiteral("get" satisfies Method),
        f.createStringLiteral("/v1/user/retrieve"),
        f.createObjectLiteralExpression([
          f.createPropertyAssignment("id", f.createStringLiteral("10")),
        ]),
      ]),
    );

    // const client = new ExpressZodAPIClient(exampleImplementation);
    const clientInstanceStatement = f.createVariableStatement(
      undefined,
      makeConst(
        this.ids.clientConst,
        f.createNewExpression(this.ids.clientClass, undefined, [
          this.ids.exampleImplementationConst,
        ]),
      ),
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
