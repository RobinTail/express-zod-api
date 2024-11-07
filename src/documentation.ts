import assert from "node:assert/strict";
import {
  OpenApiBuilder,
  ReferenceObject,
  ResponsesObject,
  SchemaObject,
  SecuritySchemeObject,
  SecuritySchemeType,
} from "openapi3-ts/oas31";
import { keys, pluck } from "ramda";
import { z } from "zod";
import { defaultStatusCodes } from "./api-response";
import { DocumentationError } from "./errors";
import { defaultInputSources, makeCleanId } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { mapLogicalContainer } from "./logical-container";
import { Method } from "./method";
import {
  OpenAPIContext,
  depictBody,
  depictRequestParams,
  depictResponse,
  depictSecurity,
  depictSecurityRefs,
  depictTags,
  ensureShortDescription,
  reformatParamsInPath,
} from "./documentation-helpers";
import { Routing } from "./routing";
import { RoutingWalkerParams, walkRouting } from "./routing-walker";
import { HandlingRules } from "./schema-walker";

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
   * @deprecated no longer used
   * @todo remove in v21
   * */
  serializer?: (schema: z.ZodTypeAny) => string;
  /**
   * @desc Handling rules for your own branded schemas.
   * @desc Keys: brands (recommended to use unique symbols).
   * @desc Values: functions having schema as first argument that you should assign type to, second one is a context.
   * @example { MyBrand: ( schema: typeof myBrandSchema, { next } ) => ({ type: "object" })
   */
  brandHandling?: HandlingRules<SchemaObject | ReferenceObject, OpenAPIContext>;
}

export class Documentation extends OpenApiBuilder {
  protected lastSecuritySchemaIds = new Map<SecuritySchemeType, number>();
  protected lastOperationIdSuffixes = new Map<string, number>();
  protected responseVariants = keys(defaultStatusCodes);
  protected references = new Map<z.ZodTypeAny, string>();

  protected makeRef(
    schema: z.ZodTypeAny,
    subject:
      | SchemaObject
      | ReferenceObject
      | (() => SchemaObject | ReferenceObject),
    name = this.references.get(schema),
  ): ReferenceObject {
    if (!name) {
      name = `Schema${this.references.size + 1}`;
      this.references.set(schema, name);
      if (typeof subject === "function") subject = subject();
    }
    if (typeof subject === "object") this.addSchema(name, subject);
    return { $ref: `#/components/schemas/${name}` };
  }

  protected ensureUniqOperationId(
    path: string,
    method: Method,
    userDefined?: string,
  ) {
    const operationId = userDefined || makeCleanId(method, path);
    let lastSuffix = this.lastOperationIdSuffixes.get(operationId);
    if (lastSuffix === undefined) {
      this.lastOperationIdSuffixes.set(operationId, 1);
      return operationId;
    }
    if (userDefined) {
      assert.fail(
        new DocumentationError({
          message: `Duplicated operationId: "${userDefined}"`,
          method,
          isResponse: false,
          path,
        }),
      );
    }
    lastSuffix++;
    this.lastOperationIdSuffixes.set(operationId, lastSuffix);
    return `${operationId}${lastSuffix}`;
  }

  protected ensureUniqSecuritySchemaName(subject: SecuritySchemeObject) {
    const serializedSubject = JSON.stringify(subject);
    for (const name in this.rootDoc.components?.securitySchemes || {}) {
      if (
        serializedSubject ===
        JSON.stringify(this.rootDoc.components?.securitySchemes?.[name])
      )
        return name;
    }
    const nextId = (this.lastSecuritySchemaIds.get(subject.type) || 0) + 1;
    this.lastSecuritySchemaIds.set(subject.type, nextId);
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
    hasSummaryFromDescription = true,
    composition = "inline",
  }: DocumentationParams) {
    super();
    this.addInfo({ title, version });
    for (const url of typeof serverUrl === "string" ? [serverUrl] : serverUrl)
      this.addServer({ url });
    const onEndpoint: RoutingWalkerParams["onEndpoint"] = (
      endpoint,
      path,
      _method,
    ) => {
      const method = _method as Method;
      const commons = {
        path,
        method,
        endpoint,
        composition,
        brandHandling,
        makeRef: this.makeRef.bind(this),
      };
      const [shortDesc, description] = (["short", "long"] as const).map(
        endpoint.getDescription.bind(endpoint),
      );
      const summary = shortDesc
        ? ensureShortDescription(shortDesc)
        : hasSummaryFromDescription && description
          ? ensureShortDescription(description)
          : undefined;
      const tags = endpoint.getTags();
      const inputSources =
        config.inputSources?.[method] || defaultInputSources[method];
      const operationId = this.ensureUniqOperationId(
        path,
        method,
        endpoint.getOperationId(method),
      );

      const depictedParams = depictRequestParams({
        ...commons,
        inputSources,
        schema: endpoint.getSchema("input"),
        description: descriptions?.requestParameter?.call(null, {
          method,
          path,
          operationId,
        }),
      });

      const responses: ResponsesObject = {};
      for (const variant of this.responseVariants) {
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
            paramNames: pluck("name", depictedParams),
            schema: endpoint.getSchema("input"),
            mimeTypes: endpoint.getMimeTypes("input"),
            description: descriptions?.requestBody?.call(null, {
              method,
              path,
              operationId,
            }),
          })
        : undefined;

      const securityRefs = depictSecurityRefs(
        mapLogicalContainer(
          depictSecurity(endpoint.getSecurity(), inputSources),
          (securitySchema) => {
            const name = this.ensureUniqSecuritySchemaName(securitySchema);
            const scopes = ["oauth2", "openIdConnect"].includes(
              securitySchema.type,
            )
              ? endpoint.getScopes().slice()
              : [];
            this.addSecurityScheme(name, securitySchema);
            return { name, scopes };
          },
        ),
      );

      this.addPath(reformatParamsInPath(path), {
        [method]: {
          operationId,
          summary,
          description,
          tags: tags.length > 0 ? tags : undefined,
          parameters: depictedParams.length > 0 ? depictedParams : undefined,
          requestBody,
          security: securityRefs.length > 0 ? securityRefs : undefined,
          responses,
        },
      });
    };
    walkRouting({ routing, onEndpoint });
    this.rootDoc.tags = config.tags ? depictTags(config.tags) : [];
  }
}
