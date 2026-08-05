import { z } from "zod";
import { responseVariants } from "./api-response";
import { type FlatObject, getInputSources, isObject } from "./common-helpers";
import type { CommonConfig } from "./config-type";
import { contentTypes } from "./content-type";
import { findJsonIncompatible } from "./deep-checks";
import { makeParamLocator } from "./documentation-helpers";
import { AbstractEndpoint } from "./endpoint";
import {
  coerceMarker,
  flattenIO,
  isParamAcceptable,
} from "./json-schema-helpers";
import type { ActualLogger } from "./logger-helpers";
import type { OnEndpoint } from "./routing-walker";
import type { Method } from "./method.ts";

interface Findings {
  isSchemaChecked: boolean;
  flat?: ReturnType<typeof flattenIO>;
  paramsChecked: Set<string>;
}

export class Diagnostics {
  #verified = new WeakMap<AbstractEndpoint, Findings>();

  constructor(
    protected logger: ActualLogger,
    protected config: CommonConfig,
  ) {}

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
    if (endpoint.getProbableRequestType() === "json") {
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

  #createFlatInput(endpoint: AbstractEndpoint): ReturnType<typeof flattenIO> {
    return flattenIO(
      z.toJSONSchema(endpoint.inputSchema, {
        unrepresentable: "any",
        io: "input",
        override: ({ zodSchema, jsonSchema }) => {
          if (
            "coerce" in zodSchema._zod.def &&
            zodSchema._zod.def.coerce === true
          )
            jsonSchema[coerceMarker] = true;
        },
      }),
    );
  }

  #checkParams(
    ref: Findings,
    endpoint: AbstractEndpoint,
    method: Method,
    path: string,
    ctx: FlatObject,
  ): void {
    if (ref.paramsChecked.has(path)) return;
    const { pathParams, getLocation, isQueryEnabled } = makeParamLocator({
      method,
      path,
      security: endpoint.security,
      inputSources: getInputSources(method, this.config.inputSources),
    });
    if (pathParams.size === 0 && !isQueryEnabled) return; // next statement can be expensive
    ref.flat ??= this.#createFlatInput(endpoint);
    for (const [name, jsonSchema] of Object.entries(ref.flat.properties)) {
      if (!isObject(jsonSchema)) continue;
      const location = getLocation(name);
      if (location !== "path" && location !== "query") continue;
      if (isParamAcceptable(jsonSchema, location)) continue;
      this.logger.warn(
        `The ${location} parameter "${name}" has a schema that most likely would not accept the parsed data, ${
          location === "path"
            ? "since path parameters always arrive as strings"
            : 'depending on the "queryParser" config option'
        }. Convert the parsed value from "z.string()" using ".transform()" method, or use "z.coerce" at least.`,
        { ...ctx, path, name, jsonSchema },
      );
    }
    for (const param of pathParams) {
      this.logger.warn(
        "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
        { ...ctx, path, param },
      );
    }
    ref.paramsChecked.add(path);
  }

  public check: OnEndpoint = (method, path, endpoint) => {
    let ref = this.#verified.get(endpoint);
    if (!ref) {
      ref = {
        isSchemaChecked: false,
        paramsChecked: new Set(),
      };
      this.#verified.set(endpoint, ref);
    }
    this.#checkSchema(ref, endpoint, { method, path });
    this.#checkParams(ref, endpoint, method, path, { method });
  };
}
