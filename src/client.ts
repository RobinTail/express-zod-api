import { Method } from "./method";
import { mimeJson } from "./mime";
import { Routing, routingCycle } from "./routing";
import { zodToTs, printNode, createTypeAlias } from "zod-to-ts";
import ts from "typescript";
const f = ts.factory;

const exportModifier = [f.createModifier(ts.SyntaxKind.ExportKeyword)];
const protectedReadonlyModifier = [
  f.createModifier(ts.SyntaxKind.ProtectedKeyword),
  f.createModifier(ts.SyntaxKind.ReadonlyKeyword),
];
const emptyPrefix = f.createTemplateHead("");
const emptyEnding = f.createTemplateTail("");
const spacingSuffix = f.createTemplateMiddle(" ");
const makeTemplate = (names: (ts.Identifier | string)[]) =>
  f.createTemplateLiteralType(
    emptyPrefix,
    names.map((name, index) =>
      f.createTemplateLiteralTypeSpan(
        f.createTypeReferenceNode(name),
        index === names.length - 1 ? emptyEnding : spacingSuffix
      )
    )
  );
const parametricIndexNode = makeTemplate(["M", "P"]);
const makeParam = ({
  name,
  type,
  mod,
}: {
  name: string;
  type: ts.TypeNode;
  mod?: ts.Modifier[];
}) =>
  f.createParameterDeclaration(
    undefined,
    mod,
    undefined,
    name,
    undefined,
    type
  );
const makeRecord = (key: ts.Identifier, value: ts.KeywordTypeSyntaxKind) =>
  f.createExpressionWithTypeArguments(f.createIdentifier("Record"), [
    f.createTypeReferenceNode(key),
    f.createKeywordTypeNode(value),
  ]);
const makeEmptyConstructor = (params: ts.ParameterDeclaration[]) =>
  f.createConstructorDeclaration(
    undefined,
    undefined,
    params,
    f.createBlock([])
  );

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

    const pathNode = f.createTypeAliasDeclaration(
      undefined,
      exportModifier,
      "Path",
      undefined,
      f.createUnionTypeNode(
        this.paths.map((path) =>
          f.createLiteralTypeNode(f.createStringLiteral(path))
        )
      )
    );

    const methodNode = f.createTypeAliasDeclaration(
      undefined,
      exportModifier,
      "Method",
      undefined,
      f.createUnionTypeNode(
        (["get", "post", "put", "delete", "patch"] as Method[]).map((method) =>
          f.createLiteralTypeNode(f.createStringLiteral(method))
        )
      )
    );

    const methodPathNode = f.createTypeAliasDeclaration(
      undefined,
      exportModifier,
      "MethodPath",
      undefined,
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
        f.createPropertySignature(
          undefined,
          `"${methodPath}"`,
          undefined,
          f.createTypeReferenceNode(this.registry[methodPath].in)
        )
      )
    );

    const responseNode = f.createInterfaceDeclaration(
      undefined,
      exportModifier,
      "Response",
      undefined,
      extenderClause,
      Object.keys(this.registry).map((methodPath) =>
        f.createPropertySignature(
          undefined,
          `"${methodPath}"`,
          undefined,
          f.createTypeReferenceNode(this.registry[methodPath].out)
        )
      )
    );

    const jsonEndpointsNode = f.createVariableStatement(
      exportModifier,
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

    const providerNode = f.createTypeAliasDeclaration(
      undefined,
      exportModifier,
      "Provider",
      undefined,
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
