import { responseVariants } from "./api-response";
import { FlatObject } from "./common-helpers";
import { contentTypes } from "./content-type";
import { assertJsonCompatible } from "./deep-checks";
import { getRoutePathParams } from "./documentation-helpers";
import { AbstractEndpoint } from "./endpoint";
import { ActualLogger } from "./logger-helpers";

export class Diagnostics {
  #verifiedEndpoints = new WeakSet<AbstractEndpoint>();
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
    this.#verifiedEndpoints.add(endpoint);
  }

  public checkPathParams(
    path: string,
    endpoint: AbstractEndpoint,
    ctx: FlatObject,
  ): void {
    const params = getRoutePathParams(path);
    for (const param of params) {
      const sample = { [param]: "123" };
      const result = endpoint.getSchema("input").safeParse(sample);
      if (!result.success) {
        const issue = result.error.issues.find(
          ({ path: subject }) => subject.length === 1 && subject[0] === param,
        );
        if (issue) {
          this.logger.warn(
            `The endpoint assigned to ${path} probably does not accept its path parameter ${param}`,
            Object.assign(ctx, { sample, issue }),
          );
        }
      } else if (
        typeof result.data === "object" &&
        result.data !== null &&
        !(param in result.data)
      ) {
        this.logger.warn(
          `The endpoint assigned to ${path} probably ignores its path parameter ${param}`,
          Object.assign(ctx, { sample, parsedInput: result.data }),
        );
      }
    }
  }
}
