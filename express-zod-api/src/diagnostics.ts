import { z } from "zod";
import { responseVariants } from "./api-response";
import { FlatObject, getRoutePathParams } from "./common-helpers";
import { contentTypes } from "./content-type";
import { findJsonIncompatible } from "./deep-checks";
import { AbstractEndpoint } from "./endpoint";
import { flattenIO } from "./json-schema-helpers";
import { ActualLogger } from "./logger-helpers";

export class Diagnostics {
  #verified = new WeakMap<
    AbstractEndpoint,
    {
      schemaChecked: boolean;
      flat?: ReturnType<typeof flattenIO>;
      paths: string[];
    }
  >();

  constructor(protected logger: ActualLogger) {}

  public check(
    endpoint: AbstractEndpoint,
    ctx: FlatObject,
    path: string,
  ): void {
    let ref = this.#verified.get(endpoint);
    if (!ref) {
      ref = { schemaChecked: false, paths: [] };
      this.#verified.set(endpoint, ref);
    }

    // Schema check
    if (!ref.schemaChecked) {
      for (const dir of ["input", "output"] as const) {
        const stack = [
          z.toJSONSchema(endpoint[`${dir}Schema`], { unrepresentable: "any" }),
        ];
        while (stack.length > 0) {
          const entry = stack.shift()!;
          if (entry.type && entry.type !== "object") {
            this.logger.warn(
              `Endpoint ${dir} schema is not object-based`,
              Object.assign(ctx, { path }),
            );
          }
          for (const prop of ["allOf", "oneOf", "anyOf"] as const)
            if (entry[prop]) stack.push(...entry[prop]);
        }
      }
      if (endpoint.requestType === "json") {
        const reason = findJsonIncompatible(endpoint.inputSchema, "input");
        if (reason) {
          this.logger.warn(
            "The final input schema of the endpoint contains an unsupported JSON payload type.",
            Object.assign(ctx, { path, reason }),
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
              Object.assign(ctx, { path, reason }),
            );
          }
        }
      }
      ref.schemaChecked = true;
    }

    // Path params check
    if (ref.paths.includes(path)) return;
    const params = getRoutePathParams(path);
    if (params.length > 0) {
      const flat =
        ref.flat ||
        flattenIO(
          z.toJSONSchema(endpoint.inputSchema, {
            unrepresentable: "any",
            io: "input",
          }),
        );
      ref.flat = flat;
      for (const param of params) {
        if (param in flat.properties) continue;
        this.logger.warn(
          "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
          Object.assign(ctx, { path, param }),
        );
      }
    }
    ref.paths.push(path);
  }
}
