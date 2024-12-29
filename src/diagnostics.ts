import { keys } from "ramda";
import { defaultStatusCodes } from "./api-response";
import { FlatObject } from "./common-helpers";
import { contentTypes } from "./content-type";
import { assertJsonCompatible } from "./deep-checks";
import { AbstractEndpoint } from "./endpoint";
import { ActualLogger } from "./logger-helpers";

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
      // eslint-disable-next-line no-restricted-syntax -- acceptable
      for (const variant of keys(defaultStatusCodes)) {
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
