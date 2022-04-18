import ts from "typescript";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import {
  cleanId,
  exportModifier,
  f,
  makeConst,
  makeInitializingConstructor,
  makeIndexedPromise,
  makeParam,
  makeParams,
  makePublicClass,
  makePublicExtendedInterface,
  makePublicLiteralType,
  makePublicReadonlyEmptyProp,
  makePublicType,
  makeQuotedProp,
  makeRecord,
  makeTemplate,
  makeTypeParams,
  parametricIndexNode,
} from "./client-helpers";
import { methods } from "./method";
import { mimeJson } from "./mime";
import { Routing, routingCycle } from "./routing";

interface Registry {
  [METHOD_PATH: string]: Record<"in" | "out", string> & { isJson: boolean };
}

export class Client {
  protected agg: ts.Node[] = [];
  protected registry: Registry = {};
  protected paths: string[] = [];

  constructor(routing: Routing) {
    routingCycle({
      routing,
      endpointCb: (endpoint, path, method) => {
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

    const clientNode = makePublicClass(
      "ExpressZodAPIClient",
      makeInitializingConstructor(
        [makeParam("provider", f.createTypeReferenceNode(providerNode.name))],
        [
          f.createExpressionStatement(
            f.createBinaryExpression(
              f.createPropertyAccessExpression(f.createThis(), "provide"),
              ts.SyntaxKind.EqualsToken,
              f.createIdentifier("provider")
            )
          ),
        ]
      ),
      [
        makePublicReadonlyEmptyProp(
          "provide",
          f.createTypeReferenceNode(providerNode.name)
        ),
      ]
    );

    ts.addSyntheticLeadingComment(
      clientNode,
      ts.SyntaxKind.MultiLineCommentTrivia,
      "\n" +
        "export const exampleProvider: Provider = async (method, path, params) => {\n" +
        "  const pathWithParams =\n" +
        "    Object.keys(params).reduce(\n" +
        "      (acc, key) => acc.replace(`:${key}`, params[key]),\n" +
        "      path\n" +
        '    ) + (method === "get" ? `?${new URLSearchParams(params)}` : "");\n' +
        "  const response = await fetch(`https://example.com${pathWithParams}`, {" +
        "    method,\n" +
        '    body: method === "get" ? undefined : JSON.stringify(params),\n' +
        "  });\n" +
        "  if (`${method} ${path}` in jsonEndpoints) {\n" +
        "    return response.json();\n" +
        "  }\n" +
        "  return response.text();\n" +
        "};\n" +
        "\n" +
        `const client = new ${clientNode.name!.text}(exampleProvider);\n` +
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
      clientNode
    );
  }

  public print(printerOptions?: ts.PrinterOptions) {
    return this.agg.map((node) => printNode(node, printerOptions)).join("\n\n");
  }
}
