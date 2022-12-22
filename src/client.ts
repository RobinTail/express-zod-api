import ts from "typescript";
import {
  createTypeAlias,
  printNode,
  zodToTs,
} from "@express-zod-api/zod-to-ts";
import {
  cleanId,
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
import { methods } from "./method";
import { mimeJson } from "./mime";
import { Routing } from "./routing";
import { walkRouting } from "./routing-walker";

interface Registry {
  [METHOD_PATH: string]: Record<"in" | "out", string> & { isJson: boolean };
}

export class Client {
  protected agg: ts.Node[] = [];
  protected registry: Registry = {};
  protected paths: string[] = [];

  constructor(routing: Routing) {
    walkRouting({
      routing,
      onEndpoint: (endpoint, path, method) => {
        const inputId = cleanId(path, method, "input");
        const responseId = cleanId(path, method, "response");
        const input = zodToTs(endpoint.getInputSchema(), inputId, {
          resolveNativeEnums: true,
        });
        const response = zodToTs(
          endpoint
            .getPositiveResponseSchema()
            .or(endpoint.getNegativeResponseSchema()),
          responseId,
          { resolveNativeEnums: true }
        );
        const inputAlias = createTypeAlias(input.node, inputId);
        const responseAlias = createTypeAlias(response.node, responseId);
        this.agg.push(
          ...input.store.nativeEnums,
          ...response.store.nativeEnums
        );
        this.agg.push(inputAlias);
        this.agg.push(responseAlias);
        if (method !== "options") {
          this.paths.push(path);
          this.registry[`${method} ${path}`] = {
            in: inputId,
            out: responseId,
            isJson: endpoint.getPositiveMimeTypes().includes(mimeJson),
          };
        }
      },
    });

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
        "  const searchParams =\n" +
        '    method === "get" ? `?${new URLSearchParams(params)}` : "";\n' +
        "  const response = await fetch(`https://example.com${path}${searchParams}`, {\n" +
        "    method: method.toUpperCase(),\n" +
        "    headers:\n" +
        '      method === "get" ? undefined : { "Content-Type": "application/json" },\n' +
        '    body: method === "get" ? undefined : JSON.stringify(params),\n' +
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
