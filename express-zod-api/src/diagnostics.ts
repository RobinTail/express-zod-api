import { responseVariants } from "./api-response";
import { FlatObject, getRoutePathParams } from "./common-helpers";
import { contentTypes } from "./content-type";
import { assertJsonCompatible } from "./deep-checks";
import { AbstractEndpoint } from "./endpoint";
import { extractObjectSchema } from "./io-schema";
import { ActualLogger } from "./logger-helpers";

export class Diagnostics {
  #verifiedEndpoints = new WeakSet<AbstractEndpoint>();
  #verifiedPaths = new WeakMap<AbstractEndpoint, string[]>();
  constructor(protected logger: ActualLogger) {}

  public checkJsonCompat(endpoint: AbstractEndpoint, ctx: FlatObject): void {
    if (this.#verifiedEndpoints.has(endpoint)) return;
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
        if (!mimeTypes?.includes(contentTypes.json)) continue;
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
    this.#verifiedEndpoints.add(endpoint);
  }

  public checkPathParams(
    path: string,
    endpoint: AbstractEndpoint,
    ctx: FlatObject,
  ): void {
    const ref = this.#verifiedPaths.get(endpoint);
    if (ref?.includes(path)) return;
    const params = getRoutePathParams(path);
    if (params.length === 0) return; // next statement is expensive
    const { shape } = extractObjectSchema(endpoint.getSchema("input"));
    for (const param of params) {
      if (param in shape) continue;
      this.logger.warn(
        "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
        Object.assign(ctx, { path, param }),
      );
    }
    if (ref) ref.push(path);
    else this.#verifiedPaths.set(endpoint, [path]);
  }
}
