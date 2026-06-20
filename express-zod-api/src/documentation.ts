import {
  type InfoObject,
  type OperationObject,
  type ReferenceObject,
  type ResponsesObject,
  type SchemaObjectValue,
  type SecuritySchemeObject,
  type SecuritySchemeType,
  type ServerObject,
  OpenApiBuilder,
} from "openapi3-ts/oas32";
import * as R from "ramda";
import { type ResponseVariant, responseVariants } from "./api-response";
import { contentTypes } from "./content-type";
import { DocumentationError } from "./errors";
import { getInputSources, makeCleanId } from "./common-helpers";
import type { CommonConfig } from "./config-type";
import { processContainers } from "./logical-container";
import type { ClientMethod } from "./method";
import { getSecurityNames } from "./security";
import {
  depictBody,
  depictRequestParams,
  depictResponse,
  depictSecurity,
  depictSecurityRefs,
  depictTags,
  trimSummary,
  reformatParamsInPath,
  nonEmpty,
  depictRequest,
  type IsHeader,
  type BrandHandling,
} from "./documentation-helpers";
import type { Routing } from "./routing";
import { walkRouting, withHead, type OnEndpoint } from "./routing-walker";

type Component =
  | `${ResponseVariant}Response`
  | "requestParameter"
  | "requestBody";

/** @desc user defined function that creates a component description from its properties */
type Descriptor = (
  props: Record<"method" | "path" | "operationId", string> & {
    statusCode?: number; // for response only
  },
) => string;

type Summarizer = (params: {
  summary?: string;
  description?: string;
  trim: typeof trimSummary;
}) => string | undefined;

/** @desc Uses description as a fallback */
const defaultSummarizer: Summarizer = ({
  description,
  summary = description,
  trim,
}) => trim(summary);

interface DocumentationParams {
  /** @desc Full Info Object customization */
  info?: InfoObject;
  /** @override info.title — shorthand */
  title?: string;
  /** @override info.version — shorthand */
  version?: string;
  /** @desc Server URL(s) or their complete definitions */
  server?:
    | string
    | [string, ...string[]]
    | ServerObject
    | [ServerObject, ...ServerObject[]];
  /**
   * @deprecated use `server` property instead
   * @todo remove in v29
   * */
  serverUrl?: string | [string, ...string[]];
  routing: Routing;
  config: CommonConfig;
  /**
   * @desc Descriptions of various components based on their properties (method, path, operationId).
   * @desc When composition set to "components", component name is generated from this description
   * @default () => `${method} ${path} ${component}`
   * */
  descriptions?: Partial<Record<Component, Descriptor>>;
  /**
   * @desc The function that ensures the maximum length for summary fields. Can optionally make them from descriptions.
   * @see defaultSummarizer
   * @see trimSummary
   * */
  summarizer?: Summarizer;
  /**
   * @desc Depict the HEAD method for each Endpoint supporting the GET method (feature of Express)
   * @default true
   * */
  hasHeadMethod?: boolean;
  /** @default inline */
  composition?: "inline" | "components";
  /**
   * @desc Handling rules for your own schemas branded with `x-brand` metadata.
   * @desc Keys: brands (recommended to use unique symbols).
   * @desc Values: functions having Zod context as first argument, second one is the framework context.
   * @example { MyBrand: ({ zodSchema, jsonSchema }) => ({ type: "object" })
   * @link https://www.npmjs.com/package/@express-zod-api/zod-plugin
   */
  brandHandling?: BrandHandling;
  /**
   * @desc Ability to configure recognition of headers among other input data
   * @desc Only applicable when "headers" is present within inputSources config option
   * @see defaultIsHeader
   * @link https://www.iana.org/assignments/http-fields/http-fields.xhtml
   * */
  isHeader?: IsHeader;
  /**
   * @desc Extended description of tags used in endpoints. For enforcing constraints:
   * @see TagOverrides
   * @example { users: "About users", files: { description: "About files", url: "https://example.com" } }
   * */
  tags?: Parameters<typeof depictTags>[0];
}

export class Documentation extends OpenApiBuilder {
  readonly #lastSecuritySchemaIds = new Map<SecuritySchemeType, number>();
  readonly #lastOperationIdSuffixes = new Map<string, number>();
  readonly #references = new Map<object | string, string>();

  #makeRef(
    key: object | string,
    value: SchemaObjectValue | ReferenceObject,
    proposedName?: string,
  ): ReferenceObject {
    let name = this.#references.get(key); // search in the cache by the given key
    if (!name) {
      let inc = proposedName ? 0 : 1;
      do {
        name = `${proposedName ?? "Schema"}${inc ? this.#references.size + inc : ""}`;
        inc++;
      } while (this.rootDoc.components?.schemas?.[name]); // search in existing references for the unique name
      this.#references.set(key, name);
    }
    this.addSchema(name, value);
    return { $ref: `#/components/schemas/${name}` };
  }

  #ensureUniqOperationId(
    path: string,
    method: ClientMethod,
    userDefined?: string,
  ) {
    const operationId = userDefined || makeCleanId(method, path);
    let lastSuffix = this.#lastOperationIdSuffixes.get(operationId);
    if (lastSuffix === undefined) {
      this.#lastOperationIdSuffixes.set(operationId, 1);
      return operationId;
    }
    if (userDefined) {
      throw new DocumentationError(`Duplicated operationId: "${userDefined}"`, {
        method,
        isResponse: false,
        path,
      });
    }
    lastSuffix++;
    this.#lastOperationIdSuffixes.set(operationId, lastSuffix);
    return `${operationId}${lastSuffix}`;
  }

  #ensureUniqSecuritySchemaName(subject: SecuritySchemeObject) {
    const serializedSubject = JSON.stringify(subject);
    for (const name in this.rootDoc.components?.securitySchemes || {}) {
      if (
        serializedSubject ===
        JSON.stringify(this.rootDoc.components?.securitySchemes?.[name])
      )
        return name;
    }
    const nextId = (this.#lastSecuritySchemaIds.get(subject.type) || 0) + 1;
    this.#lastSecuritySchemaIds.set(subject.type, nextId);
    return `${subject.type.toUpperCase()}_${nextId}`;
  }

  #addMetadata({
    title,
    version,
    serverUrl,
    tags,
    info,
    server,
  }: DocumentationParams) {
    this.addInfo({
      ...info,
      title: title ?? info?.title ?? this.rootDoc.info.title,
      version: version ?? info?.version ?? this.rootDoc.info.version,
    });
    if (tags) this.rootDoc.tags = depictTags(tags);
    if (server) {
      for (const one of Array.isArray(server) ? server : [server])
        this.addServer(typeof one === "string" ? { url: one } : one);
    }
    if (!serverUrl) return;
    for (const url of typeof serverUrl === "string" ? [serverUrl] : serverUrl)
      this.addServer({ url });
  }

  #makeEndpointHandler({
    config,
    descriptions,
    brandHandling,
    isHeader,
    summarizer = defaultSummarizer,
    composition = "inline",
  }: DocumentationParams): OnEndpoint<ClientMethod> {
    return (method, path, endpoint) => {
      const commons = {
        path,
        method,
        endpoint,
        composition,
        brandHandling,
        makeRef: this.#makeRef.bind(this),
      };
      const { description, summary, scopes, inputSchema } = endpoint;
      const inputSources = getInputSources(method, config.inputSources);
      const operationId = this.#ensureUniqOperationId(
        path,
        method,
        endpoint.getOperationId(method),
      );

      const request = depictRequest({ ...commons, schema: inputSchema });
      const depictedParams = depictRequestParams({
        ...commons,
        inputSources,
        isHeader,
        securityHeaders: getSecurityNames(endpoint.security, "header"),
        securityCookies: getSecurityNames(endpoint.security, "cookie"),
        request,
        description: descriptions?.requestParameter?.({
          method,
          path,
          operationId,
        }),
      });

      const responses: ResponsesObject = {};
      for (const variant of responseVariants) {
        const apiResponses = endpoint.getResponses(variant);
        for (const { mimeTypes, schema, statusCodes } of apiResponses) {
          for (const statusCode of statusCodes) {
            responses[statusCode] = depictResponse({
              ...commons,
              variant,
              schema,
              mimeTypes,
              statusCode,
              hasMultipleStatusCodes:
                apiResponses.length > 1 || statusCodes.length > 1,
              description: descriptions?.[`${variant}Response`]?.({
                method,
                path,
                operationId,
                statusCode,
              }),
            });
          }
        }
      }

      const requestBody = inputSources.includes("body")
        ? depictBody({
            ...commons,
            request,
            paramNames: R.pluck("name", depictedParams),
            schema: inputSchema,
            mimeType: contentTypes[endpoint.requestType],
            description: descriptions?.requestBody?.({
              method,
              path,
              operationId,
            }),
          })
        : undefined;

      const securityRefs = depictSecurityRefs(
        depictSecurity(processContainers(endpoint.security), inputSources),
        scopes,
        (securitySchema) => {
          const name = this.#ensureUniqSecuritySchemaName(securitySchema);
          this.addSecurityScheme(name, securitySchema);
          return name;
        },
      );

      const operation: OperationObject = {
        operationId,
        summary: summarizer({ summary, description, trim: trimSummary }),
        description,
        deprecated: endpoint.isDeprecated || undefined,
        tags: nonEmpty(endpoint.tags),
        parameters: nonEmpty(depictedParams),
        requestBody,
        security: nonEmpty(securityRefs),
        responses,
      };
      this.addPath(reformatParamsInPath(path), { [method]: operation });
    };
  }

  public constructor({ hasHeadMethod = true, ...rest }: DocumentationParams) {
    super();
    this.#addMetadata(rest);
    const handler = this.#makeEndpointHandler(rest);
    const onEndpoint = hasHeadMethod ? withHead(handler) : handler;
    walkRouting({ ...rest, onEndpoint });
  }
}
