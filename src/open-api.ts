import { OpenApiBuilder, OperationObject } from "openapi3-ts";
import { CommonConfig } from "./config-type";
import { Method } from "./method";
import {
  depictRequestParams,
  depictRequest,
  depictResponse,
  reformatParamsInPath,
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
  public constructor({
    routing,
    title,
    version,
    serverUrl,
    successfulResponseDescription = "Successful response",
    errorResponseDescription = "Error response",
  }: GeneratorParams) {
    super();
    this.addInfo({ title, version }).addServer({ url: serverUrl });
    const cb: RoutingCycleParams["cb"] = (endpoint, path, _method) => {
      const method = _method as Method;
      const commonParams = { path, method, endpoint };
      const depictedParams = depictRequestParams(commonParams);
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
      if (method !== "get") {
        // @todo involve config/inputSources in v4
        operation.requestBody = depictRequest(commonParams);
      }
      const swaggerCompatiblePath = reformatParamsInPath(path);
      this.addPath(swaggerCompatiblePath, {
        ...(this.rootDoc.paths?.[swaggerCompatiblePath] || {}),
        [method]: operation,
      });
    };
    routingCycle({ routing, cb });
  }
}
