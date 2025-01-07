import { responseVariants } from "./api-response.ts";
import { FlatObject } from "./common-helpers.ts";
import { contentTypes } from "./content-type.ts";
import { assertJsonCompatible } from "./deep-checks.ts";
import { AbstractEndpoint } from "./endpoint.ts";
import { ActualLogger } from "./logger-helpers.ts";

export class Diagnostics {
  #verified = new WeakSet<AbstractEndpoint>();
  constructor(protected logger: ActualLogger) {}

  public check(endpoint: AbstractEndpoint, ctx: FlatObject): void {
    if (!this.#verified.has(endpoint)) {
      if (endpoint.getRequestType() === "json") {
        try {
          assertJsonCompatible(endpoint.getSchema("input"), "in");
        } catch (reason) {
          this.logger.warn(
            "The final input schema of the endpoint contains an unsupported JSON payload type.",
            Object.assign(ctx, { reason }),
          );
        }
      }
      for (const variant of responseVariants) {
        for (const { mimeTypes, schema } of endpoint.getResponses(variant)) {
          if (mimeTypes?.includes(contentTypes.json)) {
            try {
              assertJsonCompatible(schema, "out");
            } catch (reason) {
              this.logger.warn(
                `The final ${variant} response schema of the endpoint contains an unsupported JSON payload type.`,
                Object.assign(ctx, { reason }),
              );
            }
          }
        }
      }
      this.#verified.add(endpoint);
    }
  }
}
