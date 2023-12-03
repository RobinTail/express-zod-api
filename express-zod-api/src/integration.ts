import ts from "typescript";
import { z } from "zod";
import { ZodFile } from "./file-schema";
import {
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

    const pathNode = makePublicLiteralType("Path", this.paths);
    const methodNode = makePublicLiteralType("Method", methods);

    const methodPathNode = makePublicType(
      "MethodPath",
      makeTemplate([methodNode.name, pathNode.name]),
    );

    const extenderClause = [
      f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        makeRecord(methodPathNode.name, ts.SyntaxKind.AnyKeyword),
      ]),
    ];

    const inputNode = makePublicExtendedInterface(
      "Input",
      extenderClause,
      Object.keys(this.registry).map((methodPath) =>
        makeQuotedProp(methodPath, this.registry[methodPath].in),
      ),
    );

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

    const keyParamExpression = f.createTemplateExpression(
      f.createTemplateHead(":"),
      [
        f.createTemplateSpan(
          f.createIdentifier("key"),
          f.createTemplateTail(""),
        ),
      ],
    );

    const clientNode = makePublicClass(
      "ExpressZodAPIClient",
      makeEmptyInitializingConstructor([
        makeParam(
          "implementation",
          f.createTypeReferenceNode(implementationNode.name),
          protectedReadonlyModifier,
        ),
      ]),
      [
        makePublicReadonlyProp(
          "provide",
          f.createTypeReferenceNode(providerNode.name),
          makeImplementationCallFn(
            ["method", "path", "params"],
            [
              f.createIdentifier("method"),
              makeObjectKeysReducer(
                "params",
                f.createCallExpression(
                  f.createPropertyAccessExpression(
                    f.createIdentifier("acc"),
                    "replace",
                  ),
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
              ),
              makeObjectKeysReducer(
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
              ),
            ],
          ),
        ),
      ],
    );

    ts.addSyntheticLeadingComment(
      clientNode,
      ts.SyntaxKind.MultiLineCommentTrivia,
      "\n" +
        "export const exampleImplementation: Implementation = async (\n" +
        "  method,\n" +
        "  path,\n" +
        "  params\n" +
        ") => {\n" +
        '  const hasBody = !["get", "delete"].includes(method);\n' +
        '  const searchParams = hasBody ? "" : `?${new URLSearchParams(params)}`;\n' +
        "  const response = await fetch(`https://example.com${path}${searchParams}`, {\n" +
        "    method: method.toUpperCase(),\n" +
        '    headers: hasBody ? { "Content-Type": "application/json" } : undefined,\n' +
        "    body: hasBody ? JSON.stringify(params) : undefined,\n" +
        "  });\n" +
        "  if (`${method} ${path}` in jsonEndpoints) {\n" +
        "    return response.json();\n" +
        "  }\n" +
        "  return response.text();\n" +
        "};\n" +
        "\n" +
        "const client = new ExpressZodAPIClient(exampleImplementation);\n" +
        'client.provide("get", "/v1/user/retrieve", { id: "10" });\n',
      true,
    );

    this.agg.push(
      jsonEndpointsNode,
      endpointTagsNode,
      providerNode,
      implementationNode,
      clientNode,
    );
  }

  public print(printerOptions?: ts.PrinterOptions) {
    return this.agg.map((node) => printNode(node, printerOptions)).join("\n\n");
  }
}
