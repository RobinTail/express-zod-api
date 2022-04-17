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
  [PATH: string]: Record<string, Record<"in" | "out", string>>;
}

export class Client {
  protected agg: string[] = [];
  protected registry: Registry = {};

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
          .forEach((nativeEnum) => this.agg.push(printNode(nativeEnum)));
        this.agg.push(printNode(inputAlias));
        this.agg.push(printNode(responseAlias));
        if (!(path in this.registry)) {
          this.registry[path] = {};
        }
        if (method !== "options") {
          this.registry[path][method] = { in: inputId, out: responseId };
        }
      },
    });

    const registrySchema = ts.factory.createInterfaceDeclaration(
      undefined,
      undefined,
      "Registry",
      undefined,
      undefined,
      Object.keys(this.registry).map((path) =>
        ts.factory.createPropertySignature(
          undefined,
          `"${path}"`,
          undefined,
          ts.factory.createTypeLiteralNode(
            Object.keys(this.registry[path]).map((method) =>
              ts.factory.createPropertySignature(
                undefined,
                method,
                undefined,
                ts.factory.createTypeLiteralNode(
                  Object.keys(this.registry[path][method]).map((direction) =>
                    ts.factory.createPropertySignature(
                      undefined,
                      direction,
                      undefined,
                      ts.factory.createTypeReferenceNode(
                        this.registry[path][method].in
                      )
                    )
                  )
                )
              )
            )
          )
        )
      )
    );

    this.agg.push(printNode(registrySchema));
  }

  public print() {
    return this.agg.join("\n\n");
  }
}
