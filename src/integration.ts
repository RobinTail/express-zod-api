import ts from "typescript";
import { z } from "zod";
import { ZodFile } from "./file-schema";
import {
  asyncModifier,
  exportModifier,
  f,
  makeAnyPromise,
  makeConst,
  makeEmptyInitializingConstructor,
  makeImplementationCallFn,
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
} from "./integration-helpers";
import { defaultSerializer, hasRaw, makeCleanId } from "./common-helpers";
import { methods } from "./method";
import { mimeJson } from "./mime";
import { Routing } from "./routing";
import { walkRouting } from "./routing-walker";
import { zodToTs } from "./zts";
import { createTypeAlias, printNode } from "./zts-helpers";

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
  protected agg: ts.Node[] = [];
  protected registry: Registry = {};
  protected paths: string[] = [];
  protected aliases: Record<string, ts.TypeAliasDeclaration> = {};

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
        this.agg.push(
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

    this.agg = Object.values<ts.Node>(this.aliases).concat(this.agg);

    // export type Path = "/v1/user/retrieve" | ___;
    const pathNode = makePublicLiteralType("Path", this.paths);

    // export type Method = "get" | "post" | "put" | "delete" | "patch";
    const methodNode = makePublicLiteralType("Method", methods);

    // export type MethodPath = `${Method} ${Path}`;
    const methodPathNode = makePublicType(
      "MethodPath",
      makeTemplate([methodNode.name, pathNode.name]),
    );

    // extends Record<MethodPath, any>
    const extenderClause = [
      f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        makeRecord(methodPathNode.name, ts.SyntaxKind.AnyKeyword),
      ]),
    ];

    // export interface Input ___ { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
    const inputNode = makePublicExtendedInterface(
      "Input",
      extenderClause,
      Object.keys(this.registry).map((methodPath) =>
        makeQuotedProp(methodPath, this.registry[methodPath].in),
      ),
    );

    // export interface Response ___ { "get /v1/user/retrieve": GetV1UserRetrieveResponse; }
    const responseNode = makePublicExtendedInterface(
      "Response",
      extenderClause,
      Object.keys(this.registry).map((methodPath) =>
        makeQuotedProp(methodPath, this.registry[methodPath].out),
      ),
    );

    this.agg.push(
      pathNode,
      methodNode,
      methodPathNode,
      inputNode,
      responseNode,
    );

    if (variant === "types") {
      return;
    }

    // export const jsonEndpoints = { "get /v1/user/retrieve": true }
    const jsonEndpointsNode = f.createVariableStatement(
      exportModifier,
      makeConst(
        "jsonEndpoints",
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
    const endpointTagsNode = f.createVariableStatement(
      exportModifier,
      makeConst(
        "endpointTags",
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
    const providerNode = makePublicType(
      "Provider",
      f.createFunctionTypeNode(
        makeTypeParams({ M: methodNode.name, P: pathNode.name }),
        makeParams({
          method: f.createTypeReferenceNode("M"),
          path: f.createTypeReferenceNode("P"),
          params: f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(inputNode.name),
            parametricIndexNode,
          ),
        }),
        makeIndexedPromise(responseNode.name, parametricIndexNode),
      ),
    );

    // export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
    const implementationNode = makePublicType(
      "Implementation",
      f.createFunctionTypeNode(
        undefined,
        makeParams({
          method: f.createTypeReferenceNode(methodNode.name),
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
      [
        f.createTemplateSpan(
          f.createIdentifier("key"),
          f.createTemplateTail(""),
        ),
      ],
    );

    // Object.keys(params).reduce((acc, key) => acc.replace(___, params[key]), path)
    const pathArgument = makeObjectKeysReducer(
      "params",
      f.createCallExpression(
        f.createPropertyAccessExpression(f.createIdentifier("acc"), "replace"),
        undefined,
        [
          keyParamExpression,
          f.createElementAccessExpression(
            f.createIdentifier("params"),
            f.createIdentifier("key"),
          ),
        ],
      ),
      f.createIdentifier("path"),
    );

    // Object.keys(params).reduce((acc, key) => path.indexOf(___) >= 0 ? acc : { ...acc, [key]: params[key] }, {})
    const paramsArgument = makeObjectKeysReducer(
      "params",
      f.createConditionalExpression(
        f.createBinaryExpression(
          f.createCallExpression(
            f.createPropertyAccessExpression(
              f.createIdentifier("path"),
              "indexOf",
            ),
            undefined,
            [keyParamExpression],
          ),
          ts.SyntaxKind.GreaterThanEqualsToken,
          f.createNumericLiteral(0),
        ),
        undefined,
        f.createIdentifier("acc"),
        undefined,
        f.createObjectLiteralExpression([
          f.createSpreadAssignment(f.createIdentifier("acc")),
          f.createPropertyAssignment(
            f.createComputedPropertyName(f.createIdentifier("key")),
            f.createElementAccessExpression(
              f.createIdentifier("params"),
              f.createIdentifier("key"),
            ),
          ),
        ]),
      ),
      f.createObjectLiteralExpression(),
    );

    // export class ExpressZodAPIClient { ___ }
    const clientNode = makePublicClass(
      "ExpressZodAPIClient",
      // constructor(protected readonly implementation: Implementation) {}
      makeEmptyInitializingConstructor([
        makeParam(
          "implementation",
          f.createTypeReferenceNode(implementationNode.name),
          protectedReadonlyModifier,
        ),
      ]),
      [
        // public readonly provide: Provider
        makePublicReadonlyProp(
          "provide",
          f.createTypeReferenceNode(providerNode.name),
          // = async (method, path, params) => this.implementation(___)
          makeImplementationCallFn(
            ["method", "path", "params"],
            [f.createIdentifier("method"), pathArgument, paramsArgument],
          ),
        ),
      ],
    );

    // return response.json(); return response.text();
    const [returnJsonStatement, returnTextStatement] = ["json", "text"].map(
      (method) =>
        f.createReturnStatement(
          f.createCallExpression(
            f.createPropertyAccessExpression(
              f.createIdentifier("response"),
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
        f.createTemplateExpression(f.createTemplateHead(""), [
          f.createTemplateSpan(
            f.createIdentifier("method"),
            f.createTemplateMiddle(" "),
          ),
          f.createTemplateSpan(
            f.createIdentifier("path"),
            f.createTemplateTail(""),
          ),
        ]),
        ts.SyntaxKind.InKeyword,
        f.createIdentifier("jsonEndpoints"),
      ),
      f.createBlock([returnJsonStatement]),
    );

    // const client = new ExpressZodAPIClient(exampleImplementation);
    const clientInstanceStatement = f.createVariableStatement(
      undefined,
      makeConst(
        "client",
        f.createNewExpression(
          f.createIdentifier(clientNode.name!.text),
          undefined,
          [f.createIdentifier("exampleImplementation")],
        ),
      ),
    );

    // client.provide("get", "/v1/user/retrieve", { id: "10" });
    const provideCallingStatement = f.createExpressionStatement(
      f.createCallExpression(
        f.createPropertyAccessExpression(
          f.createIdentifier("client"),
          "provide",
        ),
        undefined,
        [
          f.createStringLiteral("get"),
          f.createStringLiteral("/v1/user/retrieve"),
          f.createObjectLiteralExpression([
            f.createPropertyAssignment("id", f.createStringLiteral("10")),
          ]),
        ],
      ),
    );

    // const hasBody = !["get", "delete"].includes(method);
    const hasBodyStatement = f.createVariableStatement(
      undefined,
      makeConst(
        "hasBody",
        f.createLogicalNot(
          f.createCallExpression(
            f.createPropertyAccessExpression(
              f.createArrayLiteralExpression([
                f.createStringLiteral("get"),
                f.createStringLiteral("delete"),
              ]),
              "includes",
            ),
            undefined,
            [f.createIdentifier("method")],
          ),
        ),
      ),
    );

    // const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
    const searchParamsStatement = f.createVariableStatement(
      undefined,
      makeConst(
        "searchParams",
        f.createConditionalExpression(
          f.createIdentifier("hasBody"),
          undefined,
          f.createStringLiteral(""),
          undefined,
          f.createTemplateExpression(f.createTemplateHead("?"), [
            f.createTemplateSpan(
              f.createNewExpression(
                f.createIdentifier("URLSearchParams"),
                undefined,
                [f.createIdentifier("params")],
              ),
              f.createTemplateTail(""),
            ),
          ]),
        ),
      ),
    );

    // method: method.toUpperCase()
    const methodProperty = f.createPropertyAssignment(
      "method",
      f.createCallExpression(
        f.createPropertyAccessExpression(
          f.createIdentifier("method"),
          "toUpperCase",
        ),
        undefined,
        undefined,
      ),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = f.createPropertyAssignment(
      "headers",
      f.createConditionalExpression(
        f.createIdentifier("hasBody"),
        undefined,
        f.createObjectLiteralExpression([
          f.createPropertyAssignment(
            f.createStringLiteral("Content-Type"),
            f.createStringLiteral(mimeJson),
          ),
        ]),
        undefined,
        f.createIdentifier("undefined"),
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = f.createPropertyAssignment(
      "body",
      f.createConditionalExpression(
        f.createIdentifier("hasBody"),
        undefined,
        f.createCallExpression(
          f.createPropertyAccessExpression(
            f.createIdentifier("JSON"),
            "stringify",
          ),
          undefined,
          [f.createIdentifier("params")],
        ),
        undefined,
        f.createIdentifier("undefined"),
      ),
    );

    // const response = await fetch(`https://example.com${path}${searchParams}`, { ___ });
    const responseStatement = f.createVariableStatement(
      undefined,
      makeConst(
        "response",
        f.createAwaitExpression(
          f.createCallExpression(f.createIdentifier("fetch"), undefined, [
            f.createTemplateExpression(
              f.createTemplateHead("https://example.com"),
              [
                f.createTemplateSpan(
                  f.createIdentifier("path"),
                  f.createTemplateMiddle(""),
                ),
                f.createTemplateSpan(
                  f.createIdentifier("searchParams"),
                  f.createTemplateTail(""),
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

    // export const exampleImplementation: Implementation = async (method,path,params) => { ___ };
    const exampleImplStatement = f.createVariableStatement(
      exportModifier,
      makeConst(
        "exampleImplementation",
        f.createArrowFunction(
          asyncModifier,
          undefined,
          [
            f.createParameterDeclaration(undefined, undefined, "method"),
            f.createParameterDeclaration(undefined, undefined, "path"),
            f.createParameterDeclaration(undefined, undefined, "params"),
          ],
          undefined,
          undefined,
          f.createBlock([
            hasBodyStatement,
            searchParamsStatement,
            responseStatement,
            ifJsonStatement,
            returnTextStatement,
          ]),
        ),
        f.createTypeReferenceNode(implementationNode.name),
      ),
    );

    const exampleComment = ts.addSyntheticLeadingComment(
      f.createEmptyStatement(),
      ts.SyntaxKind.MultiLineCommentTrivia,
      [exampleImplStatement, clientInstanceStatement, provideCallingStatement]
        .map((node) => printNode(node))
        .join("\n") + "\n",
      true,
    );

    this.agg.push(
      jsonEndpointsNode,
      endpointTagsNode,
      providerNode,
      implementationNode,
      clientNode,
      exampleComment,
    );
  }

  public print(printerOptions?: ts.PrinterOptions) {
    return this.agg.map((node) => printNode(node, printerOptions)).join("\n\n");
  }
}
