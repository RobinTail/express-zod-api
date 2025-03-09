import * as R from "ramda";
import type { ZodRawShape } from "zod";
import { responseVariants } from "./api-response";
import { FlatObject, getRoutePathParams } from "./common-helpers";
import { contentTypes } from "./content-type";
import { assertJsonCompatible } from "./deep-checks";
import { AbstractEndpoint } from "./endpoint";
import { extractObjectSchema } from "./io-schema";
import { ActualLogger } from "./logger-helpers";

export class Diagnostics {
  /** @desc (catcher)(...args) => bool | ReturnValue<typeof catcher> */
  readonly #trier = R.tryCatch(assertJsonCompatible);
  #verifiedEndpoints = new WeakSet<AbstractEndpoint>();
  #verifiedPaths = new WeakMap<
    AbstractEndpoint,
    { shape: ZodRawShape; paths: string[] }
  >();

  constructor(protected logger: ActualLogger) {}

  public checkJsonCompat(endpoint: AbstractEndpoint, ctx: FlatObject): void {
    if (this.#verifiedEndpoints.has(endpoint)) return;
    if (endpoint.requestType === "json") {
      this.#trier((reason) =>
        this.logger.warn(
          "The final input schema of the endpoint contains an unsupported JSON payload type.",
          Object.assign(ctx, { reason }),
        ),
      )(endpoint.inputSchema, "in");
    }
    for (const variant of responseVariants) {
      const catcher = this.#trier((reason) =>
        this.logger.warn(
          `The final ${variant} response schema of the endpoint contains an unsupported JSON payload type.`,
          Object.assign(ctx, { reason }),
        ),
      );
      for (const { mimeTypes, schema } of endpoint.getResponses(variant)) {
        if (!mimeTypes?.includes(contentTypes.json)) continue;
        catcher(schema, "out");
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
    if (ref?.paths.includes(path)) return;
    const params = getRoutePathParams(path);
    if (params.length === 0) return; // next statement can be expensive
    const { shape } = ref || extractObjectSchema(endpoint.inputSchema);
    for (const param of params) {
      if (param in shape) continue;
      this.logger.warn(
        "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
        Object.assign(ctx, { path, param }),
      );
    }
    if (ref) ref.paths.push(path);
    else this.#verifiedPaths.set(endpoint, { shape, paths: [path] });
  }
}
