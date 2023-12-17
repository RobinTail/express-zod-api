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

const ids = {
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

interface PrintParams {
  /** @desc Typescript printer options */
  printerOptions?: ts.PrinterOptions;
  /**
   * @desc Typescript code formatter
   * @default prettier.format
   * */
  format?: (program: string) => Promise<string>;
}

export const createIntegration = ({
  routing,
  variant = "client",
  serializer = defaultSerializer,
  optionalPropStyle = { withQuestionMark: true, withUndefined: true },
}: IntegrationParams) => {
  const program: ts.Node[] = [];
  const usage: ts.Node[] = [];
  const registry: Registry = {};
  const paths: string[] = [];
  const aliases: Record<string, ts.TypeAliasDeclaration> = {};

  const getAlias = (name: string): ts.TypeReferenceNode | undefined => {
    return name in aliases ? f.createTypeReferenceNode(name) : undefined;
  };

  const makeAlias = (name: string, type: ts.TypeNode): ts.TypeReferenceNode => {
    aliases[name] = createTypeAlias(type, name);
    return getAlias(name)!;
  };

  walkRouting({
    routing,
    onEndpoint: (endpoint, path, method) => {
      const inputId = makeCleanId(path, method, "input");
      const responseId = makeCleanId(path, method, "response");
      const commons = {
        serializer,
        getAlias,
        makeAlias,
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
      program.push(
        createTypeAlias(input, inputId),
        createTypeAlias(response, responseId),
      );
      if (method !== "options") {
        paths.push(path);
        registry[`${method} ${path}`] = {
          in: inputId,
          out: responseId,
          isJson: endpoint.getMimeTypes("positive").includes(mimeJson),
          tags: endpoint.getTags(),
        };
      }
    },
  });

  program.unshift(...Object.values<ts.Node>(aliases));

  // export type Path = "/v1/user/retrieve" | ___;
  const pathType = makePublicLiteralType(ids.pathType, paths);

  // export type Method = "get" | "post" | "put" | "delete" | "patch";
  const methodType = makePublicLiteralType(ids.methodType, methods);

  // export type MethodPath = `${Method} ${Path}`;
  const methodPathType = makePublicType(
    ids.methodPathType,
    makeTemplate([ids.methodType, ids.pathType]),
  );

  // extends Record<MethodPath, any>
  const extenderClause = [
    f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
      makeRecord(ids.methodPathType, ts.SyntaxKind.AnyKeyword),
    ]),
  ];

  // export interface Input ___ { "get /v1/user/retrieve": GetV1UserRetrieveInput; }
  const inputInterface = makePublicExtendedInterface(
    ids.inputInterface,
    extenderClause,
    Object.keys(registry).map((methodPath) =>
      makeQuotedProp(methodPath, registry[methodPath].in),
    ),
  );

  // export interface Response ___ { "get /v1/user/retrieve": GetV1UserRetrieveResponse; }
  const responseInterface = makePublicExtendedInterface(
    ids.responseInterface,
    extenderClause,
    Object.keys(registry).map((methodPath) =>
      makeQuotedProp(methodPath, registry[methodPath].out),
    ),
  );

  program.push(
    pathType,
    methodType,
    methodPathType,
    inputInterface,
    responseInterface,
  );

  if (variant === "client") {
    // export const jsonEndpoints = { "get /v1/user/retrieve": true }
    const jsonEndpointsConst = f.createVariableStatement(
      exportModifier,
      makeConst(
        ids.jsonEndpointsConst,
        f.createObjectLiteralExpression(
          Object.keys(registry)
            .filter((methodPath) => registry[methodPath].isJson)
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
        ids.endpointTagsConst,
        f.createObjectLiteralExpression(
          Object.keys(registry).map((methodPath) =>
            f.createPropertyAssignment(
              `"${methodPath}"`,
              f.createArrayLiteralExpression(
                registry[methodPath].tags.map((tag) =>
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
      ids.providerType,
      f.createFunctionTypeNode(
        makeTypeParams({
          M: ids.methodType,
          P: ids.pathType,
        }),
        makeParams({
          method: f.createTypeReferenceNode("M"),
          path: f.createTypeReferenceNode("P"),
          params: f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(ids.inputInterface),
            parametricIndexNode,
          ),
        }),
        makeIndexedPromise(ids.responseInterface, parametricIndexNode),
      ),
    );

    // export type Implementation = (method: Method, path: string, params: Record<string, any>) => Promise<any>;
    const implementationType = makePublicType(
      ids.implementationType,
      f.createFunctionTypeNode(
        undefined,
        makeParams({
          method: f.createTypeReferenceNode(ids.methodType),
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
      [f.createTemplateSpan(ids.keyParameter, emptyTail)],
    );

    // Object.keys(params).reduce((acc, key) => acc.replace(___, params[key]), path)
    const pathArgument = makeObjectKeysReducer(
      ids.paramsArgument,
      f.createCallExpression(
        f.createPropertyAccessExpression(ids.accumulator, "replace"),
        undefined,
        [
          keyParamExpression,
          f.createElementAccessExpression(ids.paramsArgument, ids.keyParameter),
        ],
      ),
      ids.pathParameter,
    );

    // Object.keys(params).reduce((acc, key) => path.indexOf(___) >= 0 ? acc : { ...acc, [key]: params[key] }, {})
    const paramsArgument = makeObjectKeysReducer(
      ids.paramsArgument,
      f.createConditionalExpression(
        f.createBinaryExpression(
          f.createCallExpression(
            f.createPropertyAccessExpression(ids.pathParameter, "indexOf"),
            undefined,
            [keyParamExpression],
          ),
          ts.SyntaxKind.GreaterThanEqualsToken,
          f.createNumericLiteral(0),
        ),
        undefined,
        ids.accumulator,
        undefined,
        f.createObjectLiteralExpression([
          f.createSpreadAssignment(ids.accumulator),
          f.createPropertyAssignment(
            f.createComputedPropertyName(ids.keyParameter),
            f.createElementAccessExpression(
              ids.paramsArgument,
              ids.keyParameter,
            ),
          ),
        ]),
      ),
      f.createObjectLiteralExpression(),
    );

    // export class ExpressZodAPIClient { ___ }
    const clientClass = makePublicClass(
      ids.clientClass,
      // constructor(protected readonly implementation: Implementation) {}
      makeEmptyInitializingConstructor([
        makeParam(
          ids.implementationArgument,
          f.createTypeReferenceNode(ids.implementationType),
          protectedReadonlyModifier,
        ),
      ]),
      [
        // public readonly provide: Provider
        makePublicReadonlyProp(
          ids.provideMethod,
          f.createTypeReferenceNode(ids.providerType),
          // = async (method, path, params) => this.implementation(___)
          makeAsyncArrowFn(
            [ids.methodParameter, ids.pathParameter, ids.paramsArgument],
            f.createCallExpression(
              f.createPropertyAccessExpression(
                f.createThis(),
                ids.implementationArgument,
              ),
              undefined,
              [ids.methodParameter, pathArgument, paramsArgument],
            ),
          ),
        ),
      ],
    );

    program.push(
      jsonEndpointsConst,
      endpointTagsConst,
      providerType,
      implementationType,
      clientClass,
    );

    // method: method.toUpperCase()
    const methodProperty = f.createPropertyAssignment(
      ids.methodParameter,
      f.createCallExpression(
        f.createPropertyAccessExpression(ids.methodParameter, "toUpperCase"),
        undefined,
        undefined,
      ),
    );

    // headers: hasBody ? { "Content-Type": "application/json" } : undefined
    const headersProperty = f.createPropertyAssignment(
      ids.headersProperty,
      f.createConditionalExpression(
        ids.hasBodyConst,
        undefined,
        f.createObjectLiteralExpression([
          f.createPropertyAssignment(
            f.createStringLiteral("Content-Type"),
            f.createStringLiteral(mimeJson),
          ),
        ]),
        undefined,
        ids.undefinedValue,
      ),
    );

    // body: hasBody ? JSON.stringify(params) : undefined
    const bodyProperty = f.createPropertyAssignment(
      ids.bodyProperty,
      f.createConditionalExpression(
        ids.hasBodyConst,
        undefined,
        f.createCallExpression(
          f.createPropertyAccessExpression(
            f.createIdentifier("JSON"),
            "stringify",
          ),
          undefined,
          [ids.paramsArgument],
        ),
        undefined,
        ids.undefinedValue,
      ),
    );

    // const response = await fetch(`https://example.com${path}${searchParams}`, { ___ });
    const responseStatement = f.createVariableStatement(
      undefined,
      makeConst(
        ids.responseConst,
        f.createAwaitExpression(
          f.createCallExpression(f.createIdentifier("fetch"), undefined, [
            f.createTemplateExpression(
              f.createTemplateHead("https://example.com"),
              [
                f.createTemplateSpan(
                  ids.pathParameter,
                  f.createTemplateMiddle(""),
                ),
                f.createTemplateSpan(ids.searchParamsConst, emptyTail),
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
        ids.hasBodyConst,
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
            [ids.methodParameter],
          ),
        ),
      ),
    );

    // const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;
    const searchParamsStatement = f.createVariableStatement(
      undefined,
      makeConst(
        ids.searchParamsConst,
        f.createConditionalExpression(
          ids.hasBodyConst,
          undefined,
          f.createStringLiteral(""),
          undefined,
          f.createTemplateExpression(f.createTemplateHead("?"), [
            f.createTemplateSpan(
              f.createNewExpression(
                f.createIdentifier("URLSearchParams"),
                undefined,
                [ids.paramsArgument],
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
            f.createPropertyAccessExpression(ids.responseConst, method),
            undefined,
            undefined,
          ),
        ),
    );

    // if (`${method} ${path}` in jsonEndpoints) { ___ }
    const ifJsonStatement = f.createIfStatement(
      f.createBinaryExpression(
        f.createTemplateExpression(emptyHeading, [
          f.createTemplateSpan(ids.methodParameter, spacingMiddle),
          f.createTemplateSpan(ids.pathParameter, emptyTail),
        ]),
        ts.SyntaxKind.InKeyword,
        ids.jsonEndpointsConst,
      ),
      f.createBlock([returnJsonStatement]),
    );

    // export const exampleImplementation: Implementation = async (method,path,params) => { ___ };
    const exampleImplStatement = f.createVariableStatement(
      exportModifier,
      makeConst(
        ids.exampleImplementationConst,
        makeAsyncArrowFn(
          [ids.methodParameter, ids.pathParameter, ids.paramsArgument],
          f.createBlock([
            hasBodyStatement,
            searchParamsStatement,
            responseStatement,
            ifJsonStatement,
            returnTextStatement,
          ]),
        ),
        f.createTypeReferenceNode(ids.implementationType),
      ),
    );

    // client.provide("get", "/v1/user/retrieve", { id: "10" });
    const provideCallingStatement = f.createExpressionStatement(
      f.createCallExpression(
        f.createPropertyAccessExpression(ids.clientConst, ids.provideMethod),
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
        ids.clientConst,
        f.createNewExpression(ids.clientClass, undefined, [
          ids.exampleImplementationConst,
        ]),
      ),
    );

    usage.push(
      exampleImplStatement,
      clientInstanceStatement,
      provideCallingStatement,
    );
  }

  const print = async ({
    printerOptions,
    format: userDefined,
  }: PrintParams = {}) => {
    let format = userDefined;
    if (!format) {
      try {
        const prettierFormat = (await loadPeer<typeof Prettier>("prettier"))
          .format;
        format = (text) => prettierFormat(text, { filepath: "client.ts" });
      } catch {}
    }

    const usageExample = usage.length
      ? usage.map((node) => printNode(node, printerOptions)).join("\n")
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

    const output = program
      .concat(exampleComment)
      .map((node) => printNode(node, printerOptions))
      .join("\n\n");

    return format ? format(output) : output;
  };

  return { program, print };
};
