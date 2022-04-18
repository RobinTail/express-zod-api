import ts from "typescript";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import {
  cleanId,
  exportModifier,
  f,
  makeConst,
  makeEmptyConstructor,
  makeParam,
  makePublicLiteralType,
  makePublicProp,
  makePublicType,
  makeQuotedProp,
  makeRecord,
  makeTemplate,
  parametricIndexNode,
  protectedReadonlyModifier,
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

    const inputNode = f.createInterfaceDeclaration(
      undefined,
      exportModifier,
      "Input",
      undefined,
      extenderClause,
      Object.keys(this.registry).map((methodPath) =>
        makeQuotedProp(methodPath, this.registry[methodPath].in)
      )
    );

    const responseNode = f.createInterfaceDeclaration(
      undefined,
      exportModifier,
      "Response",
      undefined,
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
        [
          f.createTypeParameterDeclaration(
            "M",
            f.createTypeReferenceNode(methodNode.name)
          ),
          f.createTypeParameterDeclaration(
            "P",
            f.createTypeReferenceNode(pathNode.name)
          ),
        ],
        [
          makeParam({
            name: "method",
            type: f.createTypeReferenceNode("M"),
          }),
          makeParam({
            name: "path",
            type: f.createTypeReferenceNode("P"),
          }),
          makeParam({
            name: "params",
            type: f.createIndexedAccessTypeNode(
              f.createTypeReferenceNode(inputNode.name),
              parametricIndexNode
            ),
          }),
        ],
        f.createTypeReferenceNode("Promise", [
          f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(responseNode.name),
            parametricIndexNode
          ),
        ])
      )
    );

    const clientNode = f.createClassDeclaration(
      undefined,
      exportModifier,
      "ExpressZodAPIClient",
      undefined,
      undefined,
      [
        makeEmptyConstructor([
          makeParam({
            mod: protectedReadonlyModifier,
            name: "provider",
            type: f.createTypeReferenceNode(providerNode.name),
          }),
        ]),
        makePublicProp(
          "provide",
          f.createPropertyAccessExpression(f.createThis(), "provider")
        ),
      ]
    );

    ts.addSyntheticLeadingComment(
      clientNode,
      ts.SyntaxKind.MultiLineCommentTrivia,
      "\n" +
        "export const createDefaultProvider =\n" +
        `  (host: string): ${providerNode.name.text} =>\n` +
        "  async (method, path, params) => {\n" +
        "    const urlParams =\n" +
        '      method === "get" ? new URLSearchParams(params).toString() : "";\n' +
        "    const response = await fetch(`${host}${path}?${urlParams}`, {\n" +
        "      method: `${method}`,\n" +
        '      body: method === "get" ? undefined : JSON.stringify(params),\n' +
        "    });\n" +
        "    if (`${method} ${path}` in jsonEndpoints) {\n" +
        "      return response.json();\n" +
        "    }\n" +
        "    return response.text();\n" +
        "  };\n" +
        "\n" +
        `const client = new ${clientNode.name!.text}(\n` +
        '  createDefaultProvider("https://example.com")\n' +
        ");\n",
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
