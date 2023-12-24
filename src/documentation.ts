import assert from "node:assert/strict";
import {
  OpenApiBuilder,
  OperationObject,
  ReferenceObject,
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

interface DocumentationParams {
  title: string;
  version: string;
  serverUrl: string | [string, ...string[]];
  routing: Routing;
  config: CommonConfig;
  descriptions?: Partial<Record<Component, string>>;
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
        description: descriptions?.requestParameter,
      });
      const operation: OperationObject = {
        operationId,
        responses: {
          [endpoint.getStatusCode("positive")]: depictResponse({
            ...commonParams,
            description: descriptions?.positiveResponse,
            isPositive: true,
          }),
          [endpoint.getStatusCode("negative")]: depictResponse({
            ...commonParams,
            description: descriptions?.negativeResponse,
            isPositive: false,
          }),
        },
      };
      if (longDesc) {
        operation.description = longDesc;
        if (hasSummaryFromDescription && shortDesc === undefined) {
          operation.summary = ensureShortDescription(longDesc);
        }
      }
      if (shortDesc) {
        operation.summary = ensureShortDescription(shortDesc);
      }
      if (endpoint.getTags().length > 0) {
        operation.tags = endpoint.getTags();
      }
      if (depictedParams.length > 0) {
        operation.parameters = depictedParams;
      }
      if (inputSources.includes("body")) {
        operation.requestBody = depictRequest({
          ...commonParams,
          description: descriptions?.requestBody,
        });
      }
      const securityRefs = depictSecurityRefs(
        mapLogicalContainer(
          depictSecurity(endpoint.getSecurity()),
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
