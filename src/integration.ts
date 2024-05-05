import ts from "typescript";
import { z } from "zod";
import {
  emptyHeading,
  emptyTail,
  exportModifier,
  f,
  makeAnyPromise,
  makeArrowFn,
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
  makeTemplateType,
  makeTypeParams,
  parametricIndexNode,
  protectedReadonlyModifier,
  spacingMiddle,
} from "./integration-helpers";
import { defaultSerializer, makeCleanId } from "./common-helpers";
import { Method, methods } from "./method";
import { mimeJson } from "./mime";
import { loadPeer } from "./peer-helpers";
import { Routing } from "./routing";
import { walkRouting } from "./routing-walker";
import { zodToTs } from "./zts";
import { createTypeAlias, printNode } from "./zts-helpers";
import type Prettier from "prettier";

type IOKind = "input" | "response" | "positive" | "negative";

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
   * @desc Declares positive and negative response types separately and provides them within additional dictoinaries
   * @default false
   * */
  splitResponse?: boolean;
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
    string, // method+path
    Partial<Record<IOKind, string>> & {
      isJson: boolean;
      tags: string[];
    }
  >();
  protected paths: string[] = [];
  protected aliases = new Map<string, ts.TypeAliasDeclaration>();
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
  protected interfaces: { id: ts.Identifier; kind: IOKind }[] = [];

  protected getAlias(name: string): ts.TypeReferenceNode | undefined {
    return this.aliases.has(name) ? f.createTypeReferenceNode(name) : undefined;
  }

  protected makeAlias(name: string, type: ts.TypeNode): ts.TypeReferenceNode {
    this.aliases.set(name, createTypeAlias(type, name));
    return this.getAlias(name)!;
  }

  public constructor({
    routing,
    variant = "client",
    serializer = defaultSerializer,
    splitResponse = false,
    optionalPropStyle = { withQuestionMark: true, withUndefined: true },
  }: IntegrationParams) {
    walkRouting({
      routing,
      onEndpoint: (endpoint, path, method) => {
        const commons = {
          serializer,
          getAlias: this.getAlias.bind(this),
          makeAlias: this.makeAlias.bind(this),
          optionalPropStyle,
        };
        const inputId = makeCleanId(method, path, "input");
        const input = zodToTs({
          ...commons,
          schema: endpoint.getSchema("input"),
          isResponse: false,
        });
        const positiveResponseId = splitResponse
          ? makeCleanId(method, path, "positive.response")
          : undefined;
        const positiveSchema = endpoint.getSchema("positive");
        const positiveResponse = splitResponse
          ? zodToTs({
              ...commons,
              isResponse: true,
              schema: positiveSchema,
            })
          : undefined;
        const negativeResponseId = splitResponse
          ? makeCleanId(method, path, "negative.response")
          : undefined;
        const negativeSchema = endpoint.getSchema("negative");
        const negativeResponse = splitResponse
          ? zodToTs({
              ...commons,
              isResponse: true,
              schema: negativeSchema,
            })
          : undefined;
        const genericResponseId = makeCleanId(method, path, "response");
        const genericResponse =
          positiveResponseId && negativeResponseId
            ? f.createUnionTypeNode([
                f.createTypeReferenceNode(positiveResponseId),
                f.createTypeReferenceNode(negativeResponseId),
              ])
            : zodToTs({
                ...commons,
                isResponse: true,
                schema: positiveSchema.or(negativeSchema),
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
        if (method !== "options") {
          this.paths.push(path);
          this.registry.set(`${method} ${path}`, {
            input: inputId,
            positive: positiveResponseId,
            negative: negativeResponseId,
            response: genericResponseId,
            isJson: endpoint.getMimeTypes("positive").includes(mimeJson),
            tags: endpoint.getTags(),
          });
        }
      },
    });

    this.program.unshift(...Array.from(this.aliases.values()));

    // export type Path = "/v1/user/retrieve" | ___;
    this.program.push(makePublicLiteralType(this.ids.pathType, this.paths));

    // export type Method = "get" | "post" | "put" | "delete" | "patch";
    this.program.push(makePublicLiteralType(this.ids.methodType, methods));

    // export type MethodPath = `${Method} ${Path}`;
    this.program.push(
      makePublicType(
        this.ids.methodPathType,
        makeTemplateType([this.ids.methodType, this.ids.pathType]),
      ),
    );

    // extends Record<MethodPath, any>
    const extenderClause = [
      f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        makeRecord(this.ids.methodPathType, ts.SyntaxKind.AnyKeyword),
      ]),
    ];

    this.interfaces.push({
      id: this.ids.inputInterface,
      kind: "input",
    });
    if (splitResponse) {
      this.interfaces.push(
        { id: this.ids.posResponseInterface, kind: "positive" },
        { id: this.ids.negResponseInterface, kind: "negative" },
      );
    }
    this.interfaces.push({ id: this.ids.responseInterface, kind: "response" });

    const registryEntries = Array.from(this.registry.entries());

    // export interface Input ___ { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
    for (const { id, kind } of this.interfaces) {
      this.program.push(
        makePublicExtendedInterface(
          id,
          extenderClause,
          registryEntries
            .map(([methodPath, entry]) => {
              const reference = entry[kind];
              return reference
                ? makeQuotedProp(methodPath, reference)
                : undefined;
            })
            .filter(
              (entry): entry is ts.PropertySignature => entry !== undefined,
            ),
        ),
      );
    }

    if (variant === "types") {
      return;
    }

    // export const jsonEndpoints = { "get /v1/user/retrieve": true }
    const jsonEndpointsConst = f.createVariableStatement(
      exportModifier,
      makeConst(
        this.ids.jsonEndpointsConst,
        f.createObjectLiteralExpression(
          registryEntries
            .filter(([{}, { isJson }]) => isJson)
            .map(([methodPath]) =>
              f.createPropertyAssignment(`"${methodPath}"`, f.createTrue()),
            ),
        ),
      ),
    );

    // export const endpointTags = { "get /v1/user/retrieve": ["users"] }
    const endpointTagsConst = f.createVariableStatement(
      exportModifier,
      makeConst(
        this.ids.endpointTagsConst,
        f.createObjectLiteralExpression(
          registryEntries.map(([methodPath, { tags }]) =>
            f.createPropertyAssignment(
              `"${methodPath}"`,
              f.createArrayLiteralExpression(
                tags.map((tag) => f.createStringLiteral(tag)),
              ),
            ),
          ),
        ),
      ),
    );

    // export type Provider = <M extends Method, P extends Path>(method: M, path: P, params: Input[`${M} ${P}`]) =>
    // Promise<Response[`${M} ${P}`]>;
    const providerType = makePublicType(
      this.ids.providerType,
      f.createFunctionTypeNode(
        makeTypeParams({
          M: this.ids.methodType,
          P: this.ids.pathType,
        }),
        makeParams({
          method: f.createTypeReferenceNode("M"),
          path: f.createTypeReferenceNode("P"),
          params: f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(this.ids.inputInterface),
            parametricIndexNode,
          ),
        }),
        makeIndexedPromise(this.ids.responseInterface, parametricIndexNode),
      ),
    );

    // export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
    const implementationType = makePublicType(
      this.ids.implementationType,
      f.createFunctionTypeNode(
        undefined,
        makeParams({
          method: f.createTypeReferenceNode(this.ids.methodType),
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
      [f.createTemplateSpan(this.ids.keyParameter, emptyTail)],
    );

    // Object.keys(params).reduce((acc, key) => acc.replace(___, params[key]), path)
    const pathArgument = makeObjectKeysReducer(
      this.ids.paramsArgument,
      f.createCallExpression(
        f.createPropertyAccessExpression(this.ids.accumulator, "replace"),
        undefined,
        [
          keyParamExpression,
          f.createElementAccessExpression(
            this.ids.paramsArgument,
            this.ids.keyParameter,
          ),
        ],
      ),
      this.ids.pathParameter,
    );

    // Object.keys(params).reduce((acc, key) => path.indexOf(___) >= 0 ? acc : { ...acc, [key]: params[key] }, {})
    const paramsArgument = makeObjectKeysReducer(
      this.ids.paramsArgument,
      f.createConditionalExpression(
        f.createBinaryExpression(
          f.createCallExpression(
            f.createPropertyAccessExpression(this.ids.pathParameter, "indexOf"),
            undefined,
            [keyParamExpression],
          ),
          ts.SyntaxKind.GreaterThanEqualsToken,
          f.createNumericLiteral(0),
        ),
        undefined,
        this.ids.accumulator,
        undefined,
        f.createObjectLiteralExpression([
          f.createSpreadAssignment(this.ids.accumulator),
          f.createPropertyAssignment(
            f.createComputedPropertyName(this.ids.keyParameter),
            f.createElementAccessExpression(
              this.ids.paramsArgument,
              this.ids.keyParameter,
            ),
          ),
        ]),
      ),
      f.createObjectLiteralExpression(),
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
      [
        // public readonly provide: Provider
        makePublicReadonlyProp(
          this.ids.provideMethod,
          f.createTypeReferenceNode(this.ids.providerType),
          // = async (method, path, params) => this.implementation(___)
          makeArrowFn(
            [
              this.ids.methodParameter,
              this.ids.pathParameter,
              this.ids.paramsArgument,
            ],
            f.createCallExpression(
              f.createPropertyAccessExpression(
                f.createThis(),
                this.ids.implementationArgument,
              ),
              undefined,
              [this.ids.methodParameter, pathArgument, paramsArgument],
            ),
            true,
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
      this.ids.methodParameter,
      f.createCallExpression(
        f.createPropertyAccessExpression(
          this.ids.methodParameter,
          "toUpperCase",
        ),
        undefined,
        undefined,
      ),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = f.createPropertyAssignment(
      this.ids.headersProperty,
      f.createConditionalExpression(
        this.ids.hasBodyConst,
        undefined,
        f.createObjectLiteralExpression([
          f.createPropertyAssignment(
            f.createStringLiteral("Content-Type"),
            f.createStringLiteral(mimeJson),
          ),
        ]),
        undefined,
        this.ids.undefinedValue,
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = f.createPropertyAssignment(
      this.ids.bodyProperty,
      f.createConditionalExpression(
        this.ids.hasBodyConst,
        undefined,
        f.createCallExpression(
          f.createPropertyAccessExpression(
            f.createIdentifier("JSON"),
            "stringify",
          ),
          undefined,
          [this.ids.paramsArgument],
        ),
        undefined,
        this.ids.undefinedValue,
      ),
    );

    // const response = await fetch(`https://example.com${path}${searchParams}`, { ___ });
    const responseStatement = f.createVariableStatement(
      undefined,
      makeConst(
        this.ids.responseConst,
        f.createAwaitExpression(
          f.createCallExpression(f.createIdentifier("fetch"), undefined, [
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
          f.createCallExpression(
            f.createPropertyAccessExpression(
              f.createArrayLiteralExpression([
                f.createStringLiteral("get" satisfies Method),
                f.createStringLiteral("delete" satisfies Method),
              ]),
              "includes",
            ),
            undefined,
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
        f.createConditionalExpression(
          this.ids.hasBodyConst,
          undefined,
          f.createStringLiteral(""),
          undefined,
          f.createTemplateExpression(f.createTemplateHead("?"), [
            f.createTemplateSpan(
              f.createNewExpression(
                f.createIdentifier("URLSearchParams"),
                undefined,
                [this.ids.paramsArgument],
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
            f.createPropertyAccessExpression(this.ids.responseConst, method),
            undefined,
            undefined,
          ),
        ),
    );

    // if (`${method} ${path}` in jsonEndpoints) { ___ }
    const ifJsonStatement = f.createIfStatement(
      f.createBinaryExpression(
        f.createTemplateExpression(emptyHeading, [
          f.createTemplateSpan(this.ids.methodParameter, spacingMiddle),
          f.createTemplateSpan(this.ids.pathParameter, emptyTail),
        ]),
        ts.SyntaxKind.InKeyword,
        this.ids.jsonEndpointsConst,
      ),
      f.createBlock([returnJsonStatement]),
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
            ifJsonStatement,
            returnTextStatement,
          ]),
          true,
        ),
        f.createTypeReferenceNode(this.ids.implementationType),
      ),
    );

    // client.provide("get", "/v1/user/retrieve", { id: "10" });
    const provideCallingStatement = f.createExpressionStatement(
      f.createCallExpression(
        f.createPropertyAccessExpression(
          this.ids.clientConst,
          this.ids.provideMethod,
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
