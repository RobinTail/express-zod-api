import { OpenApiBuilder, OperationObject } from "openapi3-ts";
import { defaultInputSources } from "./common-helpers.js";
import { CommonConfig } from "./config-type.js";
import { Method } from "./method.js";
import {
  depictRequestParams,
  depictRequest,
  depictResponse,
  reformatParamsInPath,
} from "./open-api-helpers.js";
import { Routing, routingCycle, RoutingCycleParams } from "./routing.js";

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
      const swaggerCompatiblePath = reformatParamsInPath(path);
      this.addPath(swaggerCompatiblePath, {
        ...(this.rootDoc.paths?.[swaggerCompatiblePath] || {}),
        [method]: operation,
      });
    };
    routingCycle({ routing, endpointCb });
  }
}
