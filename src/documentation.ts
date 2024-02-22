import assert from "node:assert/strict";
import {
  OpenApiBuilder,
  OperationObject,
  ReferenceObject,
  ResponsesObject,
  SchemaObject,
  SecuritySchemeObject,
  SecuritySchemeType,
} from "openapi3-ts/oas31";
import { z } from "zod";
import { DocumentationError } from "./errors";
import {
  defaultInputSources,
  defaultSerializer,
  makeCleanId,
} from "./common-helpers";
import { CommonConfig } from "./config-type";
import { mapLogicalContainer } from "./logical-container";
import { Method } from "./method";
import {
  depictRequest,
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
   * @desc Used for comparing schemas wrapped into z.lazy() to limit the recursion
   * @default JSON.stringify() + SHA1 hash as a hex digest
   * */
  serializer?: (schema: z.ZodTypeAny) => string;
}

export class Documentation extends OpenApiBuilder {
  protected lastSecuritySchemaIds: Partial<Record<SecuritySchemeType, number>> =
    {};
  protected lastOperationIdSuffixes: Record<string, number> = {};

  protected makeRef(
    name: string,
    schema: SchemaObject | ReferenceObject,
  ): ReferenceObject {
    this.addSchema(name, schema);
    return this.getRef(name)!;
  }

  protected getRef(name: string): ReferenceObject | undefined {
    return name in (this.rootDoc.components?.schemas || {})
      ? { $ref: `#/components/schemas/${name}` }
      : undefined;
  }

  protected ensureUniqOperationId(
    path: string,
    method: Method,
    userDefinedOperationId?: string,
  ) {
    if (userDefinedOperationId) {
      assert(
        !(userDefinedOperationId in this.lastOperationIdSuffixes),
        new DocumentationError({
          message: `Duplicated operationId: "${userDefinedOperationId}"`,
          method,
          isResponse: false,
          path,
        }),
      );
      this.lastOperationIdSuffixes[userDefinedOperationId] = 1;
      return userDefinedOperationId;
    }
    const operationId = makeCleanId(method, path);
    if (operationId in this.lastOperationIdSuffixes) {
      this.lastOperationIdSuffixes[operationId]++;
      return `${operationId}${this.lastOperationIdSuffixes[operationId]}`;
    }
    this.lastOperationIdSuffixes[operationId] = 1;
    return operationId;
  }

  protected ensureUniqSecuritySchemaName(subject: SecuritySchemeObject) {
    const serializedSubject = JSON.stringify(subject);
    for (const name in this.rootDoc.components?.securitySchemes || {}) {
      if (
        serializedSubject ===
        JSON.stringify(this.rootDoc.components?.securitySchemes?.[name])
      ) {
        return name;
      }
    }
    this.lastSecuritySchemaIds[subject.type] =
      (this.lastSecuritySchemaIds?.[subject.type] || 0) + 1;
    return `${subject.type.toUpperCase()}_${
      this.lastSecuritySchemaIds[subject.type]
    }`;
  }

  public constructor({
    routing,
    config,
    title,
    version,
    serverUrl,
    descriptions,
    hasSummaryFromDescription = true,
    composition = "inline",
    serializer = defaultSerializer,
  }: DocumentationParams) {
    super();
    this.addInfo({ title, version });
    for (const url of typeof serverUrl === "string" ? [serverUrl] : serverUrl) {
      this.addServer({ url });
    }
    const onEndpoint: RoutingWalkerParams["onEndpoint"] = (
      endpoint,
      path,
      _method,
    ) => {
      const method = _method as Method;
      const commonParams = {
        path,
        method,
        endpoint,
        composition,
        serializer,
        getRef: this.getRef.bind(this),
        makeRef: this.makeRef.bind(this),
      };
      const [shortDesc, longDesc] = (["short", "long"] as const).map(
        endpoint.getDescription.bind(endpoint),
      );
      const tags = endpoint.getTags();
      const inputSources =
        config.inputSources?.[method] || defaultInputSources[method];
      const operationId = this.ensureUniqOperationId(
        path,
        method,
        endpoint.getOperationId(method),
      );

      const depictedParams = depictRequestParams({
        ...commonParams,
        inputSources,
        schema: endpoint.getSchema("input"),
        description: descriptions?.requestParameter?.call(null, {
          method,
          path,
          operationId,
        }),
      });

      const responses: ResponsesObject = {};
      for (const variant of ["positive", "negative"] as const) {
        const apiResponses = endpoint.getResponses(variant);
        for (const { mimeTypes, schema, statusCodes } of apiResponses) {
          for (const statusCode of statusCodes) {
            responses[statusCode] = depictResponse({
              ...commonParams,
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

      const operation: OperationObject = {
        operationId,
        responses,
        description: longDesc,
        summary: shortDesc
          ? ensureShortDescription(shortDesc)
          : hasSummaryFromDescription && longDesc
            ? ensureShortDescription(longDesc)
            : undefined,
        tags: tags.length > 0 ? tags : undefined,
        parameters: depictedParams.length > 0 ? depictedParams : undefined,
      };

      if (inputSources.includes("body")) {
        operation.requestBody = depictRequest({
          ...commonParams,
          schema: endpoint.getSchema("input"),
          mimeTypes: endpoint.getMimeTypes("input"),
          description: descriptions?.requestBody?.call(null, {
            method,
            path,
            operationId,
          }),
        });
      }
      const securityRefs = depictSecurityRefs(
        mapLogicalContainer(
          depictSecurity(endpoint.getSecurity(), inputSources),
          (securitySchema) => {
            const name = this.ensureUniqSecuritySchemaName(securitySchema);
            const scopes = ["oauth2", "openIdConnect"].includes(
              securitySchema.type,
            )
              ? endpoint.getScopes()
              : [];
            this.addSecurityScheme(name, securitySchema);
            return { name, scopes };
          },
        ),
      );
      if (securityRefs.length > 0) {
        operation.security = securityRefs;
      }
      this.addPath(reformatParamsInPath(path), { [method]: operation });
    };
    walkRouting({ routing, onEndpoint });
    this.rootDoc.tags = config.tags ? depictTags(config.tags) : [];
  }
}
