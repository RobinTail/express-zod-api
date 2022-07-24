import { OpenApiBuilder, OperationObject } from "openapi3-ts";
import { defaultInputSources } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { Method } from "./method";
import {
  depictRequestParams,
  depictRequest,
  depictResponse,
  reformatParamsInPath,
  depictSecurity,
} from "./open-api-helpers";
import crypto from "crypto";
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
  protected makeUniqKey(object: Record<string, any>, prefix: string): string {
    let key: string;
    do {
      key = prefix + crypto.randomBytes(16).toString("hex");
    } while (key in object);
    return key;
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
      if (depictedParams.length > 0) {
        operation.parameters = depictedParams;
      }
      if (inputSources.includes("body")) {
        operation.requestBody = depictRequest(commonParams);
      }
      const securitySchemas = depictSecurity(commonParams);
      if (securitySchemas.length > 0) {
        for (const collection of securitySchemas) {
          for (const securitySchema of collection) {
            const securitySchemaName = this.makeUniqKey(
              this.rootDoc.components?.securitySchemes || {},
              `${securitySchema.type.toUpperCase()}_`
            );
            this.addSecurityScheme(securitySchemaName, securitySchema);
            operation.security = [
              ...(operation.security || []),
              { [securitySchemaName]: [] },
            ];
          }
        }
      }
      const swaggerCompatiblePath = reformatParamsInPath(path);
      this.addPath(swaggerCompatiblePath, {
        ...(this.rootDoc.paths?.[swaggerCompatiblePath] || {}),
        [method]: operation,
      });
    };
    routingCycle({ routing, endpointCb });
  }
}
