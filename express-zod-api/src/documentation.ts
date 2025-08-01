import {
  OpenApiBuilder,
  OperationObject,
  ReferenceObject,
  ResponsesObject,
  SchemaObject,
  SecuritySchemeObject,
  SecuritySchemeType,
} from "openapi3-ts/oas31";
import * as R from "ramda";
import { responseVariants } from "./api-response";
import { contentTypes } from "./content-type";
import { DocumentationError } from "./errors";
import { getInputSources, makeCleanId } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { processContainers } from "./logical-container";
import { ClientMethod } from "./method";
import {
  depictBody,
  depictRequestParams,
  depictResponse,
  depictSecurity,
  depictSecurityRefs,
  depictTags,
  ensureShortDescription,
  reformatParamsInPath,
  IsHeader,
  nonEmpty,
  BrandHandling,
  depictRequest,
} from "./documentation-helpers";
import { Routing } from "./routing";
import { OnEndpoint, walkRouting, withHead } from "./routing-walker";

type Component =
  | "positiveResponse"
  | "negativeResponse"
  | "requestParameter"
  | "requestBody";

/** @desc user defined function that creates a component description from its properties */
type Descriptor = (
  props: Record<"method" | "path" | "operationId", string> & {
    statusCode?: number; // for response only
  },
) => string;

interface DocumentationParams {
  title: string;
  version: string;
  serverUrl: string | [string, ...string[]];
  routing: Routing;
  config: CommonConfig;
  /**
   * @desc Descriptions of various components based on their properties (method, path, operationId).
   * @desc When composition set to "components", component name is generated from this description
   * @default () => `${method} ${path} ${component}`
   * */
  descriptions?: Partial<Record<Component, Descriptor>>;
  /** @default true */
  hasSummaryFromDescription?: boolean;
  /** @default inline */
  composition?: "inline" | "components";
  /**
   * @desc Handling rules for your own branded schemas.
   * @desc Keys: brands (recommended to use unique symbols).
   * @desc Values: functions having Zod context as first argument, second one is the framework context.
   * @example { MyBrand: ( { zodSchema, jsonSchema } ) => ({ type: "object" })
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
    subject: SchemaObject | ReferenceObject,
    name = this.#references.get(key),
  ): ReferenceObject {
    if (!name) {
      name = `Schema${this.#references.size + 1}`;
      this.#references.set(key, name);
    }
    this.addSchema(name, subject);
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

  public constructor({
    routing,
    config,
    title,
    version,
    serverUrl,
    descriptions,
    brandHandling,
    tags,
    isHeader,
    hasSummaryFromDescription = true,
    composition = "inline",
  }: DocumentationParams) {
    super();
    this.addInfo({ title, version });
    for (const url of typeof serverUrl === "string" ? [serverUrl] : serverUrl)
      this.addServer({ url });
    const onEndpoint: OnEndpoint<ClientMethod> = (method, path, endpoint) => {
      const commons = {
        path,
        method,
        endpoint,
        composition,
        brandHandling,
        makeRef: this.#makeRef.bind(this),
      };
      const { description, shortDescription, scopes, inputSchema } = endpoint;
      const summary = shortDescription
        ? ensureShortDescription(shortDescription)
        : hasSummaryFromDescription && description
          ? ensureShortDescription(description)
          : undefined;
      const inputSources = getInputSources(method, config.inputSources);
      const operationId = this.#ensureUniqOperationId(
        path,
        method,
        endpoint.getOperationId(method),
      );

      const request = depictRequest({ ...commons, schema: inputSchema });
      const security = processContainers(endpoint.security);
      const depictedParams = depictRequestParams({
        ...commons,
        inputSources,
        isHeader,
        security,
        request,
        description: descriptions?.requestParameter?.call(null, {
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
              description: descriptions?.[`${variant}Response`]?.call(null, {
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
            description: descriptions?.requestBody?.call(null, {
              method,
              path,
              operationId,
            }),
          })
        : undefined;

      const securityRefs = depictSecurityRefs(
        depictSecurity(security, inputSources),
        scopes,
        (securitySchema) => {
          const name = this.#ensureUniqSecuritySchemaName(securitySchema);
          this.addSecurityScheme(name, securitySchema);
          return name;
        },
      );

      const operation: OperationObject = {
        operationId,
        summary,
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
    walkRouting({
      routing,
      onEndpoint: withHead(onEndpoint),
    });
    if (tags) this.rootDoc.tags = depictTags(tags);
  }
}
