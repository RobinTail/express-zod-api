import { z } from "zod";
import { responseVariants } from "./api-response";
import { type FlatObject, getRoutePathParams } from "./common-helpers";
import { contentTypes } from "./content-type";
import { findJsonIncompatible } from "./deep-checks";
import { AbstractEndpoint } from "./endpoint";
import type { ActualLogger } from "./logger-helpers";
import type { OnEndpoint } from "./routing-walker";

interface Findings {
  isSchemaChecked: boolean;
  paths: Set<string>;
}

export class Diagnostics {
  #verified = new WeakMap<AbstractEndpoint, Findings>();

  constructor(protected logger: ActualLogger) {}

  #checkSchema(
    ref: Findings,
    endpoint: AbstractEndpoint,
    ctx: FlatObject,
  ): void {
    if (ref.isSchemaChecked) return;
    for (const dir of ["input", "output"] as const) {
      const stack: z.core.JSONSchema.BaseSchema[] = [
        z.toJSONSchema(endpoint[`${dir}Schema`], { unrepresentable: "any" }),
      ];
      for (const entry of stack) {
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

  #checkRouteParams(
    ref: Findings,
    endpoint: AbstractEndpoint,
    route: string,
    ctx: FlatObject,
  ): void {
    if (ref.paths.has(route)) return;
    const params = getRoutePathParams(route);
    if (params.length === 0) return; // next statement can be expensive
    const props = new Set<string>();
    z.toJSONSchema(endpoint.inputSchema, {
      unrepresentable: "any",
      io: "input",
      override: ({ jsonSchema, path }) => {
        while (
          typeof path[0] === "string" &&
          ["allOf", "anyOf", "oneOf"].includes(path[0])
        )
          path = path.slice(2);
        if (path[0] === "properties" && typeof path[1] === "string")
          props.add(path[1]);
        if (path[0] === "propertyNames") {
          if (typeof jsonSchema.const === "string") props.add(jsonSchema.const);
          if (jsonSchema.enum) {
            for (const item of jsonSchema.enum)
              if (typeof item === "string") props.add(item);
          }
        }
      },
    });
    for (const param of params) {
      if (props.has(param)) continue;
      this.logger.warn(
        "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
        { ...ctx, path: route, param },
      );
    }
    ref.paths.add(route);
  }

  public check: OnEndpoint = (method, path, endpoint) => {
    let ref = this.#verified.get(endpoint);
    if (!ref) {
      ref = { isSchemaChecked: false, paths: new Set() };
      this.#verified.set(endpoint, ref);
    }
    this.#checkSchema(ref, endpoint, { method, path });
    this.#checkRouteParams(ref, endpoint, path, { method });
  };
}
