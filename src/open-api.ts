import { OpenApiBuilder, OperationObject } from "openapi3-ts";
import { Method } from "./method";
import {
  depictParams,
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
    const cb: RoutingCycleParams["cb"] = (endpoint, path, method) => {
      const depictedParams = depictParams(
        path,
        method as Method,
        endpoint.getInputSchema()
      );
      const operation: OperationObject = {
        responses: {
          "200": depictResponse({
            method: method as Method,
            path,
            description: successfulResponseDescription,
            endpoint,
            isPositive: true,
          }),
          "400": depictResponse({
            method: method as Method,
            path,
            description: errorResponseDescription,
            endpoint,
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
        operation.requestBody = depictRequest({
          method: method as Method,
          path,
          endpoint,
        });
      }
      this.addPath(path, {
        ...(this.rootDoc.paths?.[path] || {}),
        [method]: operation,
      });
    };
    routingCycle({ routing, cb });
  }
}
