import { contentTypes } from "./content-type";
import { assertJsonCompatible } from "./deep-checks";
import { AbstractEndpoint } from "./endpoint";
import { Method } from "./method";
import { GetLogger } from "./server-helpers";

export class Diagnostics {
  #verified = new WeakSet<AbstractEndpoint>();

  public verify(
    endpoint: AbstractEndpoint,
    logger: ReturnType<GetLogger>,
    path: string,
    method: Method,
  ) {
    if (!this.#verified.has(endpoint)) {
      if (endpoint.getRequestType() === "json") {
        try {
          assertJsonCompatible(endpoint.getSchema("input"), "in");
        } catch (reason) {
          logger.warn(
            "The final input schema of the endpoint contains an unsupported JSON payload type.",
            { path, method, reason },
          );
        }
      }
      for (const variant of ["positive", "negative"] as const) {
        for (const { mimeTypes, schema } of endpoint.getResponses(variant)) {
          if (mimeTypes.includes(contentTypes.json)) {
            try {
              assertJsonCompatible(schema, "out");
            } catch (reason) {
              logger.warn(
                `The final ${variant} response schema of the endpoint contains an unsupported JSON payload type.`,
                { path, method, reason },
              );
            }
          }
        }
      }
      this.#verified.add(endpoint);
    }
  }
}
