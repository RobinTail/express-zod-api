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
  depictRequestParams,
  depictRequest,
  depictResponse,
  reformatParamsInPath,
  depictSecurity,
  depictSecurityRefs,
  depictTags,
} from "./open-api-helpers";
import { Routing, routingCycle, RoutingCycleParams } from "./routing";

interface GeneratorParams {
  title: string;
  version: string;
  serverUrl: string;
  routing: Routing;
  config: CommonConfig;
  successfulResponseDescription?: string;
  errorResponseDescription?: string;
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
  }: GeneratorParams) {
    super();
    // @todo make this conditional when going to support OpenAPI 3.1.0
    delete this.rootDoc.webhooks;
    this.addInfo({ title, version }).addServer({ url: serverUrl });
    const endpointCb: RoutingCycleParams["endpointCb"] = (
      endpoint,
      path,
      _method
    ) => {
      const method = _method as Method;
      const commonParams = { path, method, endpoint };
      const inputSources =
        config.inputSources?.[method] || defaultInputSources[method];
      const depictedParams = depictRequestParams({
        ...commonParams,
        inputSources,
      });
      const operation: OperationObject = {
        responses: {
          "200": depictResponse({
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
      if (endpoint.getDescription()) {
        operation.description = endpoint.getDescription();
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
        ...(this.rootDoc.paths?.[swaggerCompatiblePath] || {}),
        [method]: operation,
      });
    };
    routingCycle({ routing, endpointCb });
    if (config.tags) {
      this.rootDoc.tags = depictTags(config.tags);
    }
  }
}
