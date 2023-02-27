import {
  OpenApiBuilder,
  OperationObject,
  SecuritySchemeObject,
  SecuritySchemeType,
} from "openapi3-ts";
import { defaultInputSources } from "./common-helpers";
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

  protected ensureUniqSecuritySchemaName(subject: SecuritySchemeObject) {
    for (const name in this.rootDoc.components?.securitySchemes || {}) {
      if (
        JSON.stringify(subject) ===
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
        responses: {
          [endpoint.getPositiveStatusCode()]: depictResponse({
            ...commonParams,
            description: successfulResponseDescription,
            isPositive: true,
          }),
          "400": depictResponse({
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
