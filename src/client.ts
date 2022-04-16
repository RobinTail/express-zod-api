import { Routing, routingCycle } from "./routing";
import { zodToTs, printNode, createTypeAlias } from "zod-to-ts";

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
  [K: string]: string | Registry;
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
        const way = path
          .split("/")
          .concat(method)
          .filter((entry) => entry.trim() !== "");
        way.reduce((parent, entry, index) => {
          if (!(entry in parent)) {
            parent[entry] =
              index === way.length - 1 ? { in: inputId, out: responseId } : {};
          }
          return parent[entry] as Registry;
        }, this.registry);
      },
    });
  }

  public print() {
    return (
      this.agg.join("\n\n") + "\n\n" + JSON.stringify(this.registry, null, 2)
    );
  }
}
