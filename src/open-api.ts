import { OpenApiBuilder, OperationObject } from "openapi3-ts";
import { Method } from "./method";
import {
  depictRequestParams,
  depictRequest,
  depictResponse,
} from "./open-api-helpers";
import { Routing, routingCycle, RoutingCycleParams } from "./routing";

interface GeneratorParams {
  title: string;
  version: string;
  serverUrl: string;
  routing: Routing;
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
        operation.requestBody = depictRequest(commonParams);
      }
      this.addPath(path, {
        ...(this.rootDoc.paths?.[path] || {}),
        [method]: operation,
      });
    };
    routingCycle({ routing, cb });
  }
}
