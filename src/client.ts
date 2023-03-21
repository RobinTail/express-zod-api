import ts from "typescript";
import { z } from "zod";
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
} from "./client-helpers";
import { defaultSerializer, makeCleanId } from "./common-helpers";
import { methods } from "./method";
import { mimeJson } from "./mime";
import { Routing } from "./routing";
import { walkRouting } from "./routing-walker";
import { zodToTs } from "./zts";
import { createTypeAlias, printNode } from "./zts-helpers";

interface Registry {
  [METHOD_PATH: string]: Record<"in" | "out", string> & { isJson: boolean };
}

interface GeneratorParams {
  routing: Routing;
  serializer?: (schema: z.ZodTypeAny) => string;
}

export class Client {
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

  constructor({ routing, serializer = defaultSerializer }: GeneratorParams) {
    walkRouting({
      routing,
      onEndpoint: (endpoint, path, method) => {
        const inputId = makeCleanId(path, method, "input");
        const responseId = makeCleanId(path, method, "response");
        const commons = {
          serializer,
          getAlias: this.getAlias.bind(this),
          makeAlias: this.makeAlias.bind(this),
        };
        const input = zodToTs({
          ...commons,
          schema: endpoint.getSchema("input"),
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
          createTypeAlias(response, responseId)
        );
        if (method !== "options") {
          this.paths.push(path);
          this.registry[`${method} ${path}`] = {
            in: inputId,
            out: responseId,
            isJson: endpoint.getMimeTypes("positive").includes(mimeJson),
          };
        }
      },
    });

    this.agg = Object.values<ts.Node>(this.aliases).concat(this.agg);

    const pathNode = makePublicLiteralType("Path", this.paths);
    const methodNode = makePublicLiteralType("Method", methods);

    const methodPathNode = makePublicType(
      "MethodPath",
      makeTemplate([methodNode.name, pathNode.name])
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
        makeQuotedProp(methodPath, this.registry[methodPath].in)
      )
    );

    const responseNode = makePublicExtendedInterface(
      "Response",
      extenderClause,
      Object.keys(this.registry).map((methodPath) =>
        makeQuotedProp(methodPath, this.registry[methodPath].out)
      )
    );

    const jsonEndpointsNode = f.createVariableStatement(
      exportModifier,
      makeConst(
        "jsonEndpoints",
        f.createObjectLiteralExpression(
          Object.keys(this.registry)
            .filter((methodPath) => this.registry[methodPath].isJson)
            .map((methodPath) =>
              f.createPropertyAssignment(`"${methodPath}"`, f.createTrue())
            )
        )
      )
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
            parametricIndexNode
          ),
        }),
        makeIndexedPromise(responseNode.name, parametricIndexNode)
      )
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
            ts.SyntaxKind.AnyKeyword
          ),
        }),
        makeAnyPromise()
      )
    );

    const keyParamExpression = f.createTemplateExpression(
      f.createTemplateHead(":"),
      [
        f.createTemplateSpan(
          f.createIdentifier("key"),
          f.createTemplateTail("")
        ),
      ]
    );

    const clientNode = makePublicClass(
      "ExpressZodAPIClient",
      makeEmptyInitializingConstructor([
        makeParam(
          "implementation",
          f.createTypeReferenceNode(implementationNode.name),
          protectedReadonlyModifier
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
                    "replace"
                  ),
                  undefined,
                  [
                    keyParamExpression,
                    f.createElementAccessExpression(
                      f.createIdentifier("params"),
                      f.createIdentifier("key")
                    ),
                  ]
                ),
                f.createIdentifier("path")
              ),
              makeObjectKeysReducer(
                "params",
                f.createConditionalExpression(
                  f.createBinaryExpression(
                    f.createCallExpression(
                      f.createPropertyAccessExpression(
                        f.createIdentifier("path"),
                        "indexOf"
                      ),
                      undefined,
                      [keyParamExpression]
                    ),
                    ts.SyntaxKind.GreaterThanEqualsToken,
                    f.createNumericLiteral(0)
                  ),
                  undefined,
                  f.createIdentifier("acc"),
                  undefined,
                  f.createObjectLiteralExpression([
                    f.createSpreadAssignment(f.createIdentifier("acc")),
                    f.createPropertyAssignment(
                      "[key]", // @todo is there a better way to do it?
                      f.createElementAccessExpression(
                        f.createIdentifier("params"),
                        f.createIdentifier("key")
                      )
                    ),
                  ])
                ),
                f.createObjectLiteralExpression()
              ),
            ]
          )
        ),
      ]
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
      true
    );

    this.agg.push(
      pathNode,
      methodNode,
      methodPathNode,
      inputNode,
      responseNode,
      jsonEndpointsNode,
      providerNode,
      implementationNode,
      clientNode
    );
  }

  public print(printerOptions?: ts.PrinterOptions) {
    return this.agg.map((node) => printNode(node, printerOptions)).join("\n\n");
  }
}
