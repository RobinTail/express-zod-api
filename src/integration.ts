import ts from "typescript";
import { z } from "zod";
import { ZodFile } from "./file-schema";
import {
  emptyHeading,
  emptyTail,
  exportModifier,
  f,
  makeAnyPromise,
  makeAsyncArrowFn,
  makeConst,
  makeEmptyInitializingConstructor,
  makeIndexedPromise,
  makeObjectKeysReducer,
  makeParam,
  makeParams,
  makePublicClass,
  makePublicExtendedInterface,
  makePublicLiteralType,
  makePublicReadonlyProp,
  makePublicType,
  makeQuotedProp,
  makeRecord,
  makeTemplate,
  makeTypeParams,
  parametricIndexNode,
  protectedReadonlyModifier,
  spacingMiddle,
} from "./integration-helpers";
import { defaultSerializer, hasRaw, makeCleanId } from "./common-helpers";
import { Method, methods } from "./method";
import { mimeJson } from "./mime";
import { loadPeer } from "./peer-helpers";
import { Routing } from "./routing";
import { walkRouting } from "./routing-walker";
import { zodToTs } from "./zts";
import { createTypeAlias, printNode } from "./zts-helpers";
import type Prettier from "prettier";

interface Registry {
  [METHOD_PATH: string]: Record<"in" | "out", string> & {
    isJson: boolean;
    tags: string[];
  };
}

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
   * @desc Used for comparing schemas wrapped into z.lazy() to limit the recursion
   * @default JSON.stringify() + SHA1 hash as a hex digest
   * */
  serializer?: (schema: z.ZodTypeAny) => string;
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
}

export class Integration {
  protected program: ts.Node[] = [];
  protected usage: ts.Node[] = [];
  protected registry: Registry = {};
  protected paths: string[] = [];
  protected aliases: Record<string, ts.TypeAliasDeclaration> = {};
  protected identifiers = {
    pathType: f.createIdentifier("Path"),
    methodType: f.createIdentifier("Method"),
    methodPathType: f.createIdentifier("MethodPath"),
    inputInterface: f.createIdentifier("Input"),
    responseInterface: f.createIdentifier("Response"),
    jsonEndpointsConst: f.createIdentifier("jsonEndpoints"),
    endpointTagsConst: f.createIdentifier("endpointTags"),
    providerType: f.createIdentifier("Provider"),
    implementationType: f.createIdentifier("Implementation"),
    clientClass: f.createIdentifier("ExpressZodAPIClient"),
    keyParameter: f.createIdentifier("key"),
    pathParameter: f.createIdentifier("path"),
    paramsArgument: f.createIdentifier("params"),
    methodParameter: f.createIdentifier("method"),
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
  } satisfies Record<string, ts.Identifier>;

  protected getAlias(name: string): ts.TypeReferenceNode | undefined {
    return name in this.aliases ? f.createTypeReferenceNode(name) : undefined;
  }

  protected makeAlias(name: string, type: ts.TypeNode): ts.TypeReferenceNode {
    this.aliases[name] = createTypeAlias(type, name);
    return this.getAlias(name)!;
  }

  constructor({
    routing,
    variant = "client",
    serializer = defaultSerializer,
    optionalPropStyle = { withQuestionMark: true, withUndefined: true },
  }: IntegrationParams) {
    walkRouting({
      routing,
      onEndpoint: (endpoint, path, method) => {
        const inputId = makeCleanId(path, method, "input");
        const responseId = makeCleanId(path, method, "response");
        const commons = {
          serializer,
          getAlias: this.getAlias.bind(this),
          makeAlias: this.makeAlias.bind(this),
          optionalPropStyle,
        };
        const inputSchema = endpoint.getSchema("input");
        const input = zodToTs({
          ...commons,
          schema: hasRaw(inputSchema) ? ZodFile.create().buffer() : inputSchema,
          isResponse: false,
        });
        const response = zodToTs({
          ...commons,
          isResponse: true,
          schema: endpoint
            .getSchema("positive")
            .or(endpoint.getSchema("negative")),
        });
        this.program.push(
          createTypeAlias(input, inputId),
          createTypeAlias(response, responseId),
        );
        if (method !== "options") {
          this.paths.push(path);
          this.registry[`${method} ${path}`] = {
            in: inputId,
            out: responseId,
            isJson: endpoint.getMimeTypes("positive").includes(mimeJson),
            tags: endpoint.getTags(),
          };
        }
      },
    });

    this.program = Object.values<ts.Node>(this.aliases).concat(this.program);

    // export type Path = "/v1/user/retrieve" | ___;
    const pathType = makePublicLiteralType(
      this.identifiers.pathType,
      this.paths,
    );

    // export type Method = "get" | "post" | "put" | "delete" | "patch";
    const methodType = makePublicLiteralType(
      this.identifiers.methodType,
      methods,
    );

    // export type MethodPath = `${Method} ${Path}`;
    const methodPathType = makePublicType(
      this.identifiers.methodPathType,
      makeTemplate([this.identifiers.methodType, this.identifiers.pathType]),
    );

    // extends Record<MethodPath, any>
    const extenderClause = [
      f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        makeRecord(this.identifiers.methodPathType, ts.SyntaxKind.AnyKeyword),
      ]),
    ];

    // export interface Input ___ { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
    const inputInterface = makePublicExtendedInterface(
      this.identifiers.inputInterface,
      extenderClause,
      Object.keys(this.registry).map((methodPath) =>
        makeQuotedProp(methodPath, this.registry[methodPath].in),
      ),
    );

    // export interface Response ___ { "get /v1/user/retrieve": GetV1UserRetrieveResponse; }
    const responseInterface = makePublicExtendedInterface(
      this.identifiers.responseInterface,
      extenderClause,
      Object.keys(this.registry).map((methodPath) =>
        makeQuotedProp(methodPath, this.registry[methodPath].out),
      ),
    );

    this.program.push(
      pathType,
      methodType,
      methodPathType,
      inputInterface,
      responseInterface,
    );

    if (variant === "types") {
      return;
    }

    // export const jsonEndpoints = { "get /v1/user/retrieve": true }
    const jsonEndpointsConst = f.createVariableStatement(
      exportModifier,
      makeConst(
        this.identifiers.jsonEndpointsConst,
        f.createObjectLiteralExpression(
          Object.keys(this.registry)
            .filter((methodPath) => this.registry[methodPath].isJson)
            .map((methodPath) =>
              f.createPropertyAssignment(`"${methodPath}"`, f.createTrue()),
            ),
        ),
      ),
    );

    // export const endpointTags = { "get /v1/user/retrieve": ["users"] }
    const endpointTagsConst = f.createVariableStatement(
      exportModifier,
      makeConst(
        this.identifiers.endpointTagsConst,
        f.createObjectLiteralExpression(
          Object.keys(this.registry).map((methodPath) =>
            f.createPropertyAssignment(
              `"${methodPath}"`,
              f.createArrayLiteralExpression(
                this.registry[methodPath].tags.map((tag) =>
                  f.createStringLiteral(tag),
                ),
              ),
            ),
          ),
        ),
      ),
    );

    // export type Provider = <M extends Method, P extends Path>(method: M, path: P, params: Input[`${M} ${P}`]) =>
    // Promise<Response[`${M} ${P}`]>;
    const providerType = makePublicType(
      this.identifiers.providerType,
      f.createFunctionTypeNode(
        makeTypeParams({
          M: this.identifiers.methodType,
          P: this.identifiers.pathType,
        }),
        makeParams({
          method: f.createTypeReferenceNode("M"),
          path: f.createTypeReferenceNode("P"),
          params: f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(this.identifiers.inputInterface),
            parametricIndexNode,
          ),
        }),
        makeIndexedPromise(
          this.identifiers.responseInterface,
          parametricIndexNode,
        ),
      ),
    );

    // export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
    const implementationType = makePublicType(
      this.identifiers.implementationType,
      f.createFunctionTypeNode(
        undefined,
        makeParams({
          method: f.createTypeReferenceNode(this.identifiers.methodType),
          path: f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword),
          params: makeRecord(
            ts.SyntaxKind.StringKeyword,
            ts.SyntaxKind.AnyKeyword,
          ),
        }),
        makeAnyPromise(),
      ),
    );

    // `:${key}`
    const keyParamExpression = f.createTemplateExpression(
      f.createTemplateHead(":"),
      [f.createTemplateSpan(this.identifiers.keyParameter, emptyTail)],
    );

    // Object.keys(params).reduce((acc, key) => acc.replace(___, params[key]), path)
    const pathArgument = makeObjectKeysReducer(
      this.identifiers.paramsArgument,
      f.createCallExpression(
        f.createPropertyAccessExpression(
          this.identifiers.accumulator,
          "replace",
        ),
        undefined,
        [
          keyParamExpression,
          f.createElementAccessExpression(
            this.identifiers.paramsArgument,
            this.identifiers.keyParameter,
          ),
        ],
      ),
      this.identifiers.pathParameter,
    );

    // Object.keys(params).reduce((acc, key) => path.indexOf(___) >= 0 ? acc : { ...acc, [key]: params[key] }, {})
    const paramsArgument = makeObjectKeysReducer(
      this.identifiers.paramsArgument,
      f.createConditionalExpression(
        f.createBinaryExpression(
          f.createCallExpression(
            f.createPropertyAccessExpression(
              this.identifiers.pathParameter,
              "indexOf",
            ),
            undefined,
            [keyParamExpression],
          ),
          ts.SyntaxKind.GreaterThanEqualsToken,
          f.createNumericLiteral(0),
        ),
        undefined,
        this.identifiers.accumulator,
        undefined,
        f.createObjectLiteralExpression([
          f.createSpreadAssignment(this.identifiers.accumulator),
          f.createPropertyAssignment(
            f.createComputedPropertyName(this.identifiers.keyParameter),
            f.createElementAccessExpression(
              this.identifiers.paramsArgument,
              this.identifiers.keyParameter,
            ),
          ),
        ]),
      ),
      f.createObjectLiteralExpression(),
    );

    // export class ExpressZodAPIClient { ___ }
    const clientClass = makePublicClass(
      this.identifiers.clientClass,
      // constructor(protected readonly implementation: Implementation) {}
      makeEmptyInitializingConstructor([
        makeParam(
          this.identifiers.implementationArgument,
          f.createTypeReferenceNode(this.identifiers.implementationType),
          protectedReadonlyModifier,
        ),
      ]),
      [
        // public readonly provide: Provider
        makePublicReadonlyProp(
          this.identifiers.provideMethod,
          f.createTypeReferenceNode(this.identifiers.providerType),
          // = async (method, path, params) => this.implementation(___)
          makeAsyncArrowFn(
            [
              this.identifiers.methodParameter,
              this.identifiers.pathParameter,
              this.identifiers.paramsArgument,
            ],
            f.createCallExpression(
              f.createPropertyAccessExpression(
                f.createThis(),
                this.identifiers.implementationArgument,
              ),
              undefined,
              [this.identifiers.methodParameter, pathArgument, paramsArgument],
            ),
          ),
        ),
      ],
    );

    this.program.push(
      jsonEndpointsConst,
      endpointTagsConst,
      providerType,
      implementationType,
      clientClass,
    );

    // method: method.toUpperCase()
    const methodProperty = f.createPropertyAssignment(
      this.identifiers.methodParameter,
      f.createCallExpression(
        f.createPropertyAccessExpression(
          this.identifiers.methodParameter,
          "toUpperCase",
        ),
        undefined,
        undefined,
      ),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = f.createPropertyAssignment(
      this.identifiers.headersProperty,
      f.createConditionalExpression(
        this.identifiers.hasBodyConst,
        undefined,
        f.createObjectLiteralExpression([
          f.createPropertyAssignment(
            f.createStringLiteral("Content-Type"),
            f.createStringLiteral(mimeJson),
          ),
        ]),
        undefined,
        this.identifiers.undefinedValue,
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = f.createPropertyAssignment(
      this.identifiers.bodyProperty,
      f.createConditionalExpression(
        this.identifiers.hasBodyConst,
        undefined,
        f.createCallExpression(
          f.createPropertyAccessExpression(
            f.createIdentifier("JSON"),
            "stringify",
          ),
          undefined,
          [this.identifiers.paramsArgument],
        ),
        undefined,
        this.identifiers.undefinedValue,
      ),
    );

    // const response = await fetch(`https://example.com${path}${searchParams}`, { ___ });
    const responseStatement = f.createVariableStatement(
      undefined,
      makeConst(
        this.identifiers.responseConst,
        f.createAwaitExpression(
          f.createCallExpression(f.createIdentifier("fetch"), undefined, [
            f.createTemplateExpression(
              f.createTemplateHead("https://example.com"),
              [
                f.createTemplateSpan(
                  this.identifiers.pathParameter,
                  f.createTemplateMiddle(""),
                ),
                f.createTemplateSpan(
                  this.identifiers.searchParamsConst,
                  emptyTail,
                ),
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
        this.identifiers.hasBodyConst,
        f.createLogicalNot(
          f.createCallExpression(
            f.createPropertyAccessExpression(
              f.createArrayLiteralExpression([
                f.createStringLiteral("get" satisfies Method),
                f.createStringLiteral("delete" satisfies Method),
              ]),
              "includes",
            ),
            undefined,
            [this.identifiers.methodParameter],
          ),
        ),
      ),
    );

    // const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
    const searchParamsStatement = f.createVariableStatement(
      undefined,
      makeConst(
        this.identifiers.searchParamsConst,
        f.createConditionalExpression(
          this.identifiers.hasBodyConst,
          undefined,
          f.createStringLiteral(""),
          undefined,
          f.createTemplateExpression(f.createTemplateHead("?"), [
            f.createTemplateSpan(
              f.createNewExpression(
                f.createIdentifier("URLSearchParams"),
                undefined,
                [this.identifiers.paramsArgument],
              ),
              emptyTail,
            ),
          ]),
        ),
      ),
    );

    // return response.json(); return response.text();
    const [returnJsonStatement, returnTextStatement] = ["json", "text"].map(
      (method) =>
        f.createReturnStatement(
          f.createCallExpression(
            f.createPropertyAccessExpression(
              this.identifiers.responseConst,
              method,
            ),
            undefined,
            undefined,
          ),
        ),
    );

    // if (`${method} ${path}` in jsonEndpoints) { ___ }
    const ifJsonStatement = f.createIfStatement(
      f.createBinaryExpression(
        f.createTemplateExpression(emptyHeading, [
          f.createTemplateSpan(this.identifiers.methodParameter, spacingMiddle),
          f.createTemplateSpan(this.identifiers.pathParameter, emptyTail),
        ]),
        ts.SyntaxKind.InKeyword,
        this.identifiers.jsonEndpointsConst,
      ),
      f.createBlock([returnJsonStatement]),
    );

    // export const exampleImplementation: Implementation = async (method,path,params) => { ___ };
    const exampleImplStatement = f.createVariableStatement(
      exportModifier,
      makeConst(
        this.identifiers.exampleImplementationConst,
        makeAsyncArrowFn(
          [
            this.identifiers.methodParameter,
            this.identifiers.pathParameter,
            this.identifiers.paramsArgument,
          ],
          f.createBlock([
            hasBodyStatement,
            searchParamsStatement,
            responseStatement,
            ifJsonStatement,
            returnTextStatement,
          ]),
        ),
        f.createTypeReferenceNode(this.identifiers.implementationType),
      ),
    );

    // client.provide("get", "/v1/user/retrieve", { id: "10" });
    const provideCallingStatement = f.createExpressionStatement(
      f.createCallExpression(
        f.createPropertyAccessExpression(
          this.identifiers.clientConst,
          this.identifiers.provideMethod,
        ),
        undefined,
        [
          f.createStringLiteral("get" satisfies Method),
          f.createStringLiteral("/v1/user/retrieve"),
          f.createObjectLiteralExpression([
            f.createPropertyAssignment("id", f.createStringLiteral("10")),
          ]),
        ],
      ),
    );

    // const client = new ExpressZodAPIClient(exampleImplementation);
    const clientInstanceStatement = f.createVariableStatement(
      undefined,
      makeConst(
        this.identifiers.clientConst,
        f.createNewExpression(this.identifiers.clientClass, undefined, [
          this.identifiers.exampleImplementationConst,
        ]),
      ),
    );

    this.usage.push(
      exampleImplStatement,
      clientInstanceStatement,
      provideCallingStatement,
    );
  }

  public async print({
    printerOptions,
    format: userDefined,
  }: {
    /** @desc Typescript printer options */
    printerOptions?: ts.PrinterOptions;
    /**
     * @desc Typescript code formatter
     * @default prettier.format
     * */
    format?: (program: string) => Promise<string>;
  } = {}) {
    let format = userDefined;
    try {
      const prettierFormat = (await loadPeer<typeof Prettier>("prettier"))
        .format;
      format = (text) => prettierFormat(text, { filepath: "client.ts" });
    } catch {}

    const usageExample = this.usage.length
      ? this.usage.map((node) => printNode(node, printerOptions)).join("\n")
      : undefined;

    const exampleComment = usageExample
      ? ts.addSyntheticLeadingComment(
          ts.addSyntheticLeadingComment(
            f.createEmptyStatement(),
            ts.SyntaxKind.SingleLineCommentTrivia,
            " Usage example:",
          ),
          ts.SyntaxKind.MultiLineCommentTrivia,
          "\n" + (format ? await format(usageExample) : usageExample),
        )
      : [];

    const output = this.program
      .concat(exampleComment)
      .map((node) => printNode(node, printerOptions))
      .join("\n\n");

    return format ? format(output) : output;
  }
}
