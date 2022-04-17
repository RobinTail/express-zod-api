import { Method } from "./method";
import { mimeJson } from "./mime";
import { Routing, routingCycle } from "./routing";
import { zodToTs, printNode, createTypeAlias } from "zod-to-ts";
import ts from "typescript";

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

    const pathSchema = ts.factory.createTypeAliasDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Path",
      undefined,
      ts.factory.createUnionTypeNode(
        this.paths.map((path) =>
          ts.factory.createLiteralTypeNode(ts.factory.createStringLiteral(path))
        )
      )
    );

    const methodSchema = ts.factory.createTypeAliasDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Method",
      undefined,
      ts.factory.createUnionTypeNode(
        (["get", "post", "put", "delete", "patch"] as Method[]).map((method) =>
          ts.factory.createLiteralTypeNode(
            ts.factory.createStringLiteral(method)
          )
        )
      )
    );

    const methodPathSchema = ts.factory.createTypeAliasDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      "MethodPath",
      undefined,
      ts.factory.createTemplateLiteralType(ts.factory.createTemplateHead(""), [
        ts.factory.createTemplateLiteralTypeSpan(
          ts.factory.createTypeReferenceNode(methodSchema.name),
          ts.factory.createTemplateMiddle(" ")
        ),
        ts.factory.createTemplateLiteralTypeSpan(
          ts.factory.createTypeReferenceNode(pathSchema.name),
          ts.factory.createTemplateTail("")
        ),
      ])
    );

    const extender = [
      ts.factory.createHeritageClause(ts.SyntaxKind.ExtendsKeyword, [
        ts.factory.createExpressionWithTypeArguments(
          ts.factory.createIdentifier("Record"),
          [
            ts.factory.createTypeReferenceNode(methodPathSchema.name),
            ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
          ]
        ),
      ]),
    ];

    const inputSchema = ts.factory.createInterfaceDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Input",
      undefined,
      extender,
      Object.keys(this.registry).map((methodPath) =>
        ts.factory.createPropertySignature(
          undefined,
          `"${methodPath}"`,
          undefined,
          ts.factory.createTypeReferenceNode(this.registry[methodPath].in)
        )
      )
    );

    const responseSchema = ts.factory.createInterfaceDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Response",
      undefined,
      extender,
      Object.keys(this.registry).map((methodPath) =>
        ts.factory.createPropertySignature(
          undefined,
          `"${methodPath}"`,
          undefined,
          ts.factory.createTypeReferenceNode(this.registry[methodPath].out)
        )
      )
    );

    const jsonResponseList = ts.factory.createVariableStatement(
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      ts.factory.createVariableDeclarationList(
        [
          ts.factory.createVariableDeclaration(
            "jsonEndpoints",
            undefined,
            undefined,
            ts.factory.createObjectLiteralExpression(
              Object.keys(this.registry)
                .filter((methodPath) => this.registry[methodPath].isJson)
                .map((methodPath) =>
                  ts.factory.createPropertyAssignment(
                    `"${methodPath}"`,
                    ts.factory.createTrue()
                  )
                )
            )
          ),
        ],
        ts.NodeFlags.Const
      )
    );

    const mpParams = ts.factory.createTemplateLiteralType(
      ts.factory.createTemplateHead(""),
      [
        ts.factory.createTemplateLiteralTypeSpan(
          ts.factory.createTypeReferenceNode("M"),
          ts.factory.createTemplateMiddle(" ")
        ),
        ts.factory.createTemplateLiteralTypeSpan(
          ts.factory.createTypeReferenceNode("P"),
          ts.factory.createTemplateTail("")
        ),
      ]
    );

    const providerSchema = ts.factory.createTypeAliasDeclaration(
      undefined,
      [ts.factory.createModifier(ts.SyntaxKind.ExportKeyword)],
      "Provider",
      undefined,
      ts.factory.createFunctionTypeNode(
        [
          ts.factory.createTypeParameterDeclaration(
            "M",
            ts.factory.createTypeReferenceNode(methodSchema.name)
          ),
          ts.factory.createTypeParameterDeclaration(
            "P",
            ts.factory.createTypeReferenceNode(pathSchema.name)
          ),
        ],
        [
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            "method",
            undefined,
            ts.factory.createTypeReferenceNode("M")
          ),
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            "path",
            undefined,
            ts.factory.createTypeReferenceNode("P")
          ),
          ts.factory.createParameterDeclaration(
            undefined,
            undefined,
            undefined,
            "params",
            undefined,
            ts.factory.createIndexedAccessTypeNode(
              ts.factory.createTypeReferenceNode(inputSchema.name),
              mpParams
            )
          ),
        ],
        ts.factory.createTypeReferenceNode("Promise", [
          ts.factory.createIndexedAccessTypeNode(
            ts.factory.createTypeReferenceNode(responseSchema.name),
            mpParams
          ),
        ])
      )
    );

    this.agg.push(
      pathSchema,
      methodSchema,
      methodPathSchema,
      inputSchema,
      responseSchema,
      jsonResponseList,
      providerSchema
    );
  }

  public print() {
    return this.agg.map((node) => printNode(node)).join("\n\n");
  }
}
