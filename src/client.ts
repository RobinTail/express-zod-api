import { Method } from "./method";
import { mimeJson } from "./mime";
import { Routing, routingCycle } from "./routing";
import { zodToTs, printNode, createTypeAlias } from "zod-to-ts";
import ts from "typescript";
const f = ts.factory;

const cleanId = (path: string, method: string, suffix: string) => {
  return [method]
    .concat(path.split("/"))
    .concat(suffix)
    .map((entry) => entry.replace(/[^A-Z0-9]/i, ""))
    .map(
      (entry) => entry.slice(0, 1).toUpperCase() + entry.slice(1).toLowerCase()
    )
    .join("");
};

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
        const inputSchema = zodToTs(endpoint.getInputSchema(), inputId, {
          resolveNativeEnums: true,
        });
        const responseSchema = zodToTs(
          endpoint
            .getPositiveResponseSchema()
            .or(endpoint.getNegativeResponseSchema()),
          responseId,
          { resolveNativeEnums: true }
        );
        const inputAlias = createTypeAlias(inputSchema.node, inputId);
        const responseAlias = createTypeAlias(responseSchema.node, responseId);
        inputSchema.store.nativeEnums
          .concat(responseSchema.store.nativeEnums)
          .forEach((nativeEnum) => this.agg.push(nativeEnum));
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

    const pathSchema = f.createTypeAliasDeclaration(
      undefined,
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Path",
      undefined,
      f.createUnionTypeNode(
        this.paths.map((path) =>
          f.createLiteralTypeNode(f.createStringLiteral(path))
        )
      )
    );

    const methodSchema = f.createTypeAliasDeclaration(
      undefined,
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Method",
      undefined,
      f.createUnionTypeNode(
        (["get", "post", "put", "delete", "patch"] as Method[]).map((method) =>
          f.createLiteralTypeNode(f.createStringLiteral(method))
        )
      )
    );

    const methodPathSchema = f.createTypeAliasDeclaration(
      undefined,
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      "MethodPath",
      undefined,
      f.createTemplateLiteralType(f.createTemplateHead(""), [
        f.createTemplateLiteralTypeSpan(
          f.createTypeReferenceNode(methodSchema.name),
          f.createTemplateMiddle(" ")
        ),
        f.createTemplateLiteralTypeSpan(
          f.createTypeReferenceNode(pathSchema.name),
          f.createTemplateTail("")
        ),
      ])
    );

    const extender = [
      f.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        f.createExpressionWithTypeArguments(f.createIdentifier("Record"), [
          f.createTypeReferenceNode(methodPathSchema.name),
          f.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
        ]),
      ]),
    ];

    const inputSchema = f.createInterfaceDeclaration(
      undefined,
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Input",
      undefined,
      extender,
      Object.keys(this.registry).map((methodPath) =>
        f.createPropertySignature(
          undefined,
          `"${methodPath}"`,
          undefined,
          f.createTypeReferenceNode(this.registry[methodPath].in)
        )
      )
    );

    const responseSchema = f.createInterfaceDeclaration(
      undefined,
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Response",
      undefined,
      extender,
      Object.keys(this.registry).map((methodPath) =>
        f.createPropertySignature(
          undefined,
          `"${methodPath}"`,
          undefined,
          f.createTypeReferenceNode(this.registry[methodPath].out)
        )
      )
    );

    const jsonResponseList = f.createVariableStatement(
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      f.createVariableDeclarationList(
        [
          f.createVariableDeclaration(
            "jsonEndpoints",
            undefined,
            undefined,
            f.createObjectLiteralExpression(
              Object.keys(this.registry)
                .filter((methodPath) => this.registry[methodPath].isJson)
                .map((methodPath) =>
                  f.createPropertyAssignment(`"${methodPath}"`, f.createTrue())
                )
            )
          ),
        ],
        ts.NodeFlags.Const
      )
    );

    const mpParams = f.createTemplateLiteralType(f.createTemplateHead(""), [
      f.createTemplateLiteralTypeSpan(
        f.createTypeReferenceNode("M"),
        f.createTemplateMiddle(" ")
      ),
      f.createTemplateLiteralTypeSpan(
        f.createTypeReferenceNode("P"),
        f.createTemplateTail("")
      ),
    ]);

    const providerSchema = f.createTypeAliasDeclaration(
      undefined,
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Provider",
      undefined,
      f.createFunctionTypeNode(
        [
          f.createTypeParameterDeclaration(
            "M",
            f.createTypeReferenceNode(methodSchema.name)
          ),
          f.createTypeParameterDeclaration(
            "P",
            f.createTypeReferenceNode(pathSchema.name)
          ),
        ],
        [
          f.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            "method",
            undefined,
            f.createTypeReferenceNode("M")
          ),
          f.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            "path",
            undefined,
            f.createTypeReferenceNode("P")
          ),
          f.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            "params",
            undefined,
            f.createIndexedAccessTypeNode(
              f.createTypeReferenceNode(inputSchema.name),
              mpParams
            )
          ),
        ],
        f.createTypeReferenceNode("Promise", [
          f.createIndexedAccessTypeNode(
            f.createTypeReferenceNode(responseSchema.name),
            mpParams
          ),
        ])
      )
    );

    const clientClass = f.createClassDeclaration(
      undefined,
      [f.createModifier(ts.SyntaxKind.ExportKeyword)],
      "ExpressZodAPIClient",
      undefined,
      undefined,
      [
        f.createConstructorDeclaration(
          undefined,
          undefined,
          [
            f.createParameterDeclaration(
              undefined,
              [
                f.createModifier(ts.SyntaxKind.ProtectedKeyword),
                f.createModifier(ts.SyntaxKind.ReadonlyKeyword),
              ],
              undefined,
              "provider",
              undefined,
              f.createTypeReferenceNode(providerSchema.name)
            ),
          ],
          f.createBlock([])
        ),
        f.createPropertyDeclaration(
          undefined,
          [f.createModifier(ts.SyntaxKind.PublicKeyword)],
          "provide",
          undefined,
          undefined,
          f.createPropertyAccessExpression(f.createThis(), "provider")
        ),
      ]
    );

    ts.addSyntheticLeadingComment(
      clientClass,
      ts.SyntaxKind.MultiLineCommentTrivia,
      "\n" +
        "export const createDefaultProvider =\n" +
        "  (host: string): Provider =>\n" +
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
        "const client = new ExpressZodAPIClient(\n" +
        '  createDefaultProvider("https://example.com")\n' +
        ");\n",
      true
    );

    this.agg.push(
      pathSchema,
      methodSchema,
      methodPathSchema,
      inputSchema,
      responseSchema,
      jsonResponseList,
      providerSchema,
      clientClass
    );
  }

  public print() {
    return this.agg.map((node) => printNode(node)).join("\n\n");
  }
}
