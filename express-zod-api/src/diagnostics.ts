import { z } from "zod";
import { responseVariants } from "./api-response";
import { getRoutePathParams } from "./common-helpers";
import { contentTypes } from "./content-type";
import { findJsonIncompatible } from "./deep-checks";
import { AbstractEndpoint } from "./endpoint";
import { flattenIO } from "./json-schema-helpers";
import { ActualLogger } from "./logger-helpers";
import { Method } from "./method";
import type { OnEndpoint } from "./routing-walker";

interface Findings {
  isSchemaChecked: boolean;
  flat?: ReturnType<typeof flattenIO>;
  paths: Set<string>;
}

export class Diagnostics {
  #verified = new WeakMap<AbstractEndpoint, Findings>();

  constructor(protected logger: ActualLogger) {}

  #checkSchema(
    ref: Findings,
    endpoint: AbstractEndpoint,
    ctx: { method: Method; path: string },
  ): void {
    if (ref.isSchemaChecked) return;
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
          { ...ctx, reason },
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
            { ...ctx, reason },
          );
        }
      }
    }
    ref.isSchemaChecked = true;
  }

  #checkPathParams(
    ref: Findings,
    method: Method,
    path: string,
    endpoint: AbstractEndpoint,
  ): void {
    if (ref.paths.has(path)) return;
    const params = getRoutePathParams(path);
    if (params.length === 0) return; // next statement can be expensive
    ref.flat ??= flattenIO(
      z.toJSONSchema(endpoint.inputSchema, {
        unrepresentable: "any",
        io: "input",
      }),
    );
    for (const param of params) {
      if (param in ref.flat.properties) continue;
      this.logger.warn(
        "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
        { method, path, param },
      );
    }
    ref.paths.add(path);
  }

  public check: OnEndpoint = (method, path, endpoint) => {
    let ref = this.#verified.get(endpoint);
    if (!ref) {
      ref = { isSchemaChecked: false, paths: new Set() };
      this.#verified.set(endpoint, ref);
    }
    this.#checkSchema(ref, endpoint, { method, path });
    this.#checkPathParams(ref, method, path, endpoint);
  };
}
