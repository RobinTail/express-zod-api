import type { $ZodShape } from "@zod/core";
import { z } from "zod";
import { responseVariants } from "./api-response";
import { FlatObject, getRoutePathParams } from "./common-helpers";
import { contentTypes } from "./content-type";
import { findJsonIncompatible } from "./deep-checks";
import { AbstractEndpoint } from "./endpoint";
import { extractObjectSchema } from "./io-schema";
import { ActualLogger } from "./logger-helpers";

export class Diagnostics {
  #verifiedEndpoints = new WeakSet<AbstractEndpoint>();
  #verifiedPaths = new WeakMap<
    AbstractEndpoint,
    { shape: $ZodShape; paths: string[] }
  >();

  constructor(protected logger: ActualLogger) {}

  public checkSchema(endpoint: AbstractEndpoint, ctx: FlatObject): void {
    if (this.#verifiedEndpoints.has(endpoint)) return;
    for (const dir of ["input", "output"] as const) {
      const stack = [
        z.toJSONSchema(endpoint[`${dir}Schema`], { unrepresentable: "any" }),
      ];
      while (stack.length > 0) {
        const entry = stack.shift()!;
        if (entry.type && entry.type !== "object")
          this.logger.warn(`Endpoint ${dir} schema is not object-based`, ctx);
        for (const prop of ["allOf", "oneOf", "anyOf"] as const)
          if (entry[prop]) stack.push(...entry[prop]);
      }
    }
    if (endpoint.requestType === "json") {
      const reason = findJsonIncompatible(endpoint.inputSchema, "input");
      if (reason) {
        this.logger.warn(
          "The final input schema of the endpoint contains an unsupported JSON payload type.",
          Object.assign(ctx, { reason }),
        );
      }
    }
    for (const variant of responseVariants) {
      for (const { mimeTypes, schema } of endpoint.getResponses(variant)) {
        if (!mimeTypes?.includes(contentTypes.json)) continue;
        const reason = findJsonIncompatible(schema, "output");
        if (reason) {
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
