import { z } from "zod";
import { responseVariants } from "./api-response";
import {
  type FlatObject,
  getInputSources,
  getRoutePathParams,
  isObject,
} from "./common-helpers";
import type { CommonConfig } from "./config-type";
import { contentTypes } from "./content-type";
import {
  findJsonIncompatible,
  getObjectProperties,
  isStringSatisfiable,
} from "./deep-checks";
import { defaultIsHeader } from "./documentation-helpers";
import { AbstractEndpoint } from "./endpoint";
import { flattenIO } from "./json-schema-helpers";
import type { ActualLogger } from "./logger-helpers";
import type { SomeMethod } from "./method";
import type { OnEndpoint } from "./routing-walker";
import { getSecurityNames } from "./security";

interface Findings {
  isSchemaChecked: boolean;
  flat?: ReturnType<typeof flattenIO>;
  paths: Set<string>;
  stringOnlyChecked: boolean;
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

  #checkPathParams(
    ref: Findings,
    endpoint: AbstractEndpoint,
    path: string,
    ctx: FlatObject,
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
        { ...ctx, path, param },
      );
    }
    ref.paths.add(path);
  }

  #checkStringOnlyParams(
    ref: Findings,
    endpoint: AbstractEndpoint,
    method: SomeMethod,
    path: string,
    ctx: FlatObject,
  ): void {
    if (ref.stringOnlyChecked) return;
    const sources = getInputSources(method, this.config.inputSources);
    const areParamsEnabled = sources.includes("params");
    const areHeadersEnabled = sources.includes("headers");
    const areCookiesEnabled =
      sources.includes("cookies") || sources.includes("signedCookies");
    const isQueryEnabled = sources.includes("query") && method !== "query";
    if (!areParamsEnabled && !isQueryEnabled) return;
    ref.flat ??= flattenIO(
      z.toJSONSchema(endpoint.inputSchema, {
        unrepresentable: "any",
        io: "input",
      }),
    );
    const pathParams = new Set(getRoutePathParams(path));
    const securityHeaders = areHeadersEnabled
      ? getSecurityNames(endpoint.security, "header")
      : undefined;
    const securityCookies = areCookiesEnabled
      ? getSecurityNames(endpoint.security, "cookie")
      : undefined;
    const getLocation = (name: string): "path" | "query" | undefined => {
      if (areParamsEnabled && pathParams.has(name)) return "path";
      if (areCookiesEnabled && securityCookies?.has(name)) return;
      if (areHeadersEnabled && defaultIsHeader(name, securityHeaders)) return;
      if (isQueryEnabled) return "query";
    };
    const properties = getObjectProperties(endpoint.inputSchema);
    for (const [name, jsonSchema] of Object.entries(ref.flat.properties)) {
      if (!isObject(jsonSchema)) continue;
      const location = getLocation(name);
      if (!location) continue;
      const schema = properties[name];
      if (!schema || isStringSatisfiable(schema)) continue;
      this.logger.warn(
        `The ${location} parameter ${name} can never be satisfied: ${schema._zod.def.type} is documented but parameter values always arrive as strings.`,
        { ...ctx, path, name },
      );
    }
    ref.stringOnlyChecked = true;
  }

  public check: OnEndpoint = (method, path, endpoint) => {
    let ref = this.#verified.get(endpoint);
    if (!ref) {
      ref = {
        isSchemaChecked: false,
        paths: new Set(),
        stringOnlyChecked: false,
      };
      this.#verified.set(endpoint, ref);
    }
    this.#checkSchema(ref, endpoint, { method, path });
    this.#checkPathParams(ref, endpoint, path, { method });
    this.#checkStringOnlyParams(ref, endpoint, method as SomeMethod, path, {
      method,
    });
  };
}
