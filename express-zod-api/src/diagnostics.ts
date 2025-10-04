import { z } from "zod";
import { responseVariants } from "./api-response.ts";
import { FlatObject, getRoutePathParams } from "./common-helpers.ts";
import { contentTypes } from "./content-type.ts";
import { findJsonIncompatible } from "./deep-checks.ts";
import { AbstractEndpoint } from "./endpoint.ts";
import { flattenIO } from "./json-schema-helpers.ts";
import { ActualLogger } from "./logger-helpers.ts";

export class Diagnostics {
  #verifiedEndpoints = new WeakSet<AbstractEndpoint>();
  #verifiedPaths = new WeakMap<
    AbstractEndpoint,
    { flat: ReturnType<typeof flattenIO>; paths: string[] }
  >();
  protected logger: ActualLogger;

  constructor(logger: ActualLogger) {
    this.logger = logger;
  }

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
    const flat =
      ref?.flat ||
      flattenIO(
        z.toJSONSchema(endpoint.inputSchema, {
          unrepresentable: "any",
          io: "input",
        }),
      );
    for (const param of params) {
      if (param in flat.properties) continue;
      this.logger.warn(
        "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
        Object.assign(ctx, { path, param }),
      );
    }
    if (ref) ref.paths.push(path);
    else this.#verifiedPaths.set(endpoint, { flat, paths: [path] });
  }
}
