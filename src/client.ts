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

export class Client {
  public agg: string[] = [];

  constructor(routing: Routing) {
    routingCycle({
      routing,
      endpointCb: (endpoint, path, method) => {
        const inputId = cleanId(path, method, "input");
        const responseId = cleanId(path, method, "response");
        const inputNode = zodToTs(endpoint.getInputSchema(), inputId).node;
        const responseNode = zodToTs(
          endpoint
            .getPositiveResponseSchema()
            .or(endpoint.getNegativeResponseSchema()),
          responseId
        ).node;
        const inputAlias = createTypeAlias(inputNode, inputId);
        const responseAlias = createTypeAlias(responseNode, responseId);
        this.agg.push(printNode(inputAlias));
        this.agg.push(printNode(responseAlias));
      },
    });
  }
}
