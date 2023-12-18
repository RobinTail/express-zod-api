import assert from "node:assert/strict";
import type {
  OpenApiBuilder,
  OperationObject,
  ReferenceObject,
  SchemaObject,
  SecuritySchemeObject,
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
import { loadPeer } from "./peer-helpers";
import { Routing } from "./routing";
import { RoutingWalkerParams, walkRouting } from "./routing-walker";

interface DocumentationParams {
  title: string;
  version: string;
  serverUrl: string | [string, ...string[]];
  routing: Routing;
  config: CommonConfig;
  /** @default Successful response */
  successfulResponseDescription?: string;
  /** @default Error response */
  errorResponseDescription?: string;
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

export const createDocumentation = async ({
  routing,
  config,
  title,
  version,
  serverUrl,
  successfulResponseDescription = "Successful response",
  errorResponseDescription = "Error response",
  hasSummaryFromDescription = true,
  composition = "inline",
  serializer = defaultSerializer,
}: DocumentationParams) => {
  const lastSecuritySchemaIds: Partial<Record<string, number>> = {};
  const lastOperationIdSuffixes: Record<string, number> = {};

  const ensureUniqOperationId = (
    path: string,
    method: Method,
    userDefinedOperationId?: string,
  ) => {
    if (userDefinedOperationId) {
      assert(
        !(userDefinedOperationId in lastOperationIdSuffixes),
        new DocumentationError({
          message: `Duplicated operationId: "${userDefinedOperationId}"`,
          method,
          isResponse: false,
          path,
        }),
      );
      lastOperationIdSuffixes[userDefinedOperationId] = 1;
      return userDefinedOperationId;
    }
    const operationId = makeCleanId(path, method);
    if (operationId in lastOperationIdSuffixes) {
      lastOperationIdSuffixes[operationId]++;
      return `${operationId}${lastOperationIdSuffixes[operationId]}`;
    }
    lastOperationIdSuffixes[operationId] = 1;
    return operationId;
  };

  const BuilderClass = await loadPeer<{ new (): OpenApiBuilder }>(
    `openapi3-ts/oas31`,
    "OpenApiBuilder",
  );

  const builder = new BuilderClass().addInfo({ title, version });
  for (const url of typeof serverUrl === "string" ? [serverUrl] : serverUrl) {
    builder.addServer({ url });
  }

  const getRef = (name: string): ReferenceObject | undefined =>
    name in (builder.rootDoc.components?.schemas || {})
      ? { $ref: `#/components/schemas/${name}` }
      : undefined;

  const makeRef = (name: string, schema: SchemaObject | ReferenceObject) => {
    builder.addSchema(name, schema);
    return getRef(name)!;
  };

  const ensureUniqSecuritySchemaName = (subject: SecuritySchemeObject) => {
    const serializedSubject = JSON.stringify(subject);
    for (const name in builder.rootDoc.components?.securitySchemes || {}) {
      if (
        serializedSubject ===
        JSON.stringify(builder.rootDoc.components?.securitySchemes?.[name])
      ) {
        return name;
      }
    }
    lastSecuritySchemaIds[subject.type] =
      (lastSecuritySchemaIds?.[subject.type] || 0) + 1;
    return `${subject.type.toUpperCase()}_${
      lastSecuritySchemaIds[subject.type]
    }`;
  };

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
      getRef,
      makeRef,
    };
    const [shortDesc, longDesc] = (["short", "long"] as const).map(
      endpoint.getDescription.bind(endpoint),
    );
    const inputSources =
      config.inputSources?.[method] || defaultInputSources[method];
    const depictedParams = depictRequestParams({
      ...commonParams,
      inputSources,
    });
    const operationId = ensureUniqOperationId(
      path,
      method,
      endpoint.getOperationId(method),
    );
    const operation: OperationObject = {
      operationId,
      responses: {
        [endpoint.getStatusCode("positive")]: depictResponse({
          ...commonParams,
          clue: successfulResponseDescription,
          isPositive: true,
        }),
        [endpoint.getStatusCode("negative")]: depictResponse({
          ...commonParams,
          clue: errorResponseDescription,
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
      operation.requestBody = depictRequest(commonParams);
    }
    const securityRefs = depictSecurityRefs(
      mapLogicalContainer(
        depictSecurity(endpoint.getSecurity()),
        (securitySchema) => {
          const name = ensureUniqSecuritySchemaName(securitySchema);
          const scopes = ["oauth2", "openIdConnect"].includes(
            securitySchema.type,
          )
            ? endpoint.getScopes()
            : [];
          builder.addSecurityScheme(name, securitySchema);
          return { name, scopes };
        },
      ),
    );
    if (securityRefs.length > 0) {
      operation.security = securityRefs;
    }
    const swaggerCompatiblePath = reformatParamsInPath(path);
    builder.addPath(swaggerCompatiblePath, {
      [method]: operation,
    });
  };
  walkRouting({ routing, onEndpoint });
  builder.rootDoc.tags = config.tags ? depictTags(config.tags) : [];

  return { builder, print: () => builder.getSpecAsYaml() };
};
