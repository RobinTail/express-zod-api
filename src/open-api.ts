import {
  OpenApiBuilder,
  OperationObject,
  ReferenceObject,
  SchemaObject,
  SecuritySchemeObject,
  SecuritySchemeType,
  isReferenceObject,
} from "openapi3-ts";
import { defaultInputSources, makeCleanId } from "./common-helpers";
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
} from "./open-api-helpers";
import { Routing } from "./routing";
import { RoutingWalkerParams, walkRouting } from "./routing-walker";

interface GeneratorParams {
  title: string;
  version: string;
  serverUrl: string;
  routing: Routing;
  config: CommonConfig;
  /** @default Successful response */
  successfulResponseDescription?: string;
  /** @default Error response */
  errorResponseDescription?: string;
  /** @default true */
  hasSummaryFromDescription?: boolean;
}

export class OpenAPI extends OpenApiBuilder {
  protected lastSecuritySchemaIds: Partial<Record<SecuritySchemeType, number>> =
    {};
  protected lastOperationIdSuffixes: Record<string, number> = {};
  protected lastSchemaRefSuffix: number = 0;

  protected ensureSchemaReference(
    subject: SchemaObject | ReferenceObject
  ): ReferenceObject {
    if (isReferenceObject(subject)) {
      return subject;
    }
    const serializedSubject = JSON.stringify(subject);
    for (const ref in this.rootDoc.components?.schemas || {}) {
      const entry = this.rootDoc.components?.schemas?.[ref];
      if (entry && serializedSubject === JSON.stringify(entry)) {
        return { $ref: ref };
      }
    }
    this.lastSchemaRefSuffix++;
    const ref = makeCleanId(
      subject.description?.split(/\s/).join("/") || "Schema",
      (Array.isArray(subject.type) ? subject.type[0] : subject.type) ||
        "Custom",
      `${this.lastSchemaRefSuffix}`
    );
    this.addSchema(ref, subject);
    return { $ref: ref };
  }

  protected ensureUniqOperationId(path: string, method: Method) {
    const operationId = makeCleanId(path, method);
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
    successfulResponseDescription = "Successful response",
    errorResponseDescription = "Error response",
    hasSummaryFromDescription = true,
  }: GeneratorParams) {
    super();
    this.addInfo({ title, version }).addServer({ url: serverUrl });
    const onEndpoint: RoutingWalkerParams["onEndpoint"] = (
      endpoint,
      path,
      _method
    ) => {
      const method = _method as Method;
      const commonParams = { path, method, endpoint };
      const [shortDesc, longDesc] = (["short", "long"] as const).map(
        endpoint.getDescription.bind(endpoint)
      );
      const inputSources =
        config.inputSources?.[method] || defaultInputSources[method];
      const depictedParams = depictRequestParams({
        ...commonParams,
        inputSources,
      });
      const operation: OperationObject = {
        operationId: this.ensureUniqOperationId(path, method),
        responses: {
          [endpoint.getStatusCode("positive")]: depictResponse({
            ...commonParams,
            description: successfulResponseDescription,
            isPositive: true,
          }),
          [endpoint.getStatusCode("negative")]: depictResponse({
            ...commonParams,
            description: errorResponseDescription,
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
            const name = this.ensureUniqSecuritySchemaName(securitySchema);
            const scopes = ["oauth2", "openIdConnect"].includes(
              securitySchema.type
            )
              ? endpoint.getScopes()
              : [];
            this.addSecurityScheme(name, securitySchema);
            return { name, scopes };
          }
        )
      );
      if (securityRefs.length > 0) {
        operation.security = securityRefs;
      }
      const swaggerCompatiblePath = reformatParamsInPath(path);
      this.addPath(swaggerCompatiblePath, {
        [method]: operation,
      });
    };
    walkRouting({ routing, onEndpoint });
    this.rootDoc.tags = config.tags ? depictTags(config.tags) : [];
  }
}
