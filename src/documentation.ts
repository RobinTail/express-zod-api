import assert from "node:assert/strict";
import type { OpenApiBuilder as Builder30 } from "openapi3-ts/oas30";
import type { OpenApiBuilder as Builder31 } from "openapi3-ts/oas31";
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
import {
  CommonRef,
  CommonSchemaOrRef,
  CommonSecurity,
  OAS,
  SomeOperation,
} from "./oas-types";
import { loadPeer } from "./peer-helpers";
import { Routing } from "./routing";
import { RoutingWalkerParams, walkRouting } from "./routing-walker";

interface DocumentationParams<V extends OAS> {
  oas?: V;
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

export async function createDocumentation(
  props: DocumentationParams<"3.0">,
): Promise<{
  builder: Builder30;
  print: () => string;
}>;
export async function createDocumentation(
  props: DocumentationParams<"3.1">,
): Promise<{
  builder: Builder31;
  print: () => string;
}>;
export async function createDocumentation<V extends OAS>({
  oas = "3.0" as V,
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
}: DocumentationParams<V>) {
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

  const BuilderClass = await loadPeer<{ new (): Builder31 | Builder30 }>(
    `openapi3-ts/${oas === "3.1" ? "oas31" : "oas30"}`,
    "OpenApiBuilder",
  );

  const builder = new BuilderClass().addInfo({ title, version });
  for (const url of typeof serverUrl === "string" ? [serverUrl] : serverUrl) {
    builder.addServer({ url });
  }

  const getRef = (name: string): CommonRef | undefined =>
    name in (builder.rootDoc.components?.schemas || {})
      ? { $ref: `#/components/schemas/${name}` }
      : undefined;

  const makeRef = (name: string, schema: CommonSchemaOrRef) => {
    builder.addSchema(name, schema);
    return getRef(name)!;
  };

  const ensureUniqSecuritySchemaName = (subject: CommonSecurity) => {
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
      oas,
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
    const operation: SomeOperation = {
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
}
