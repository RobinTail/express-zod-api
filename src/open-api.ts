import { OpenApiBuilder, OperationObject } from "openapi3-ts";
import { Method } from "./method";
import {
  depictIOExamples,
  depictParams,
  depictRequest,
  depictResponse,
  depictSchema,
  excludeExampleFromDepiction,
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
      const positiveDepiction = excludeExampleFromDepiction(
        depictSchema({
          schema: endpoint.getPositiveResponseSchema(),
          isResponse: true,
        })
      );
      const positiveExamples = depictIOExamples(
        endpoint.getPositiveResponseSchema(),
        true
      );
      const negativeDepiction = excludeExampleFromDepiction(
        depictSchema({
          schema: endpoint.getNegativeResponseSchema(),
          isResponse: true,
        })
      );
      const negativeExamples = depictIOExamples(
        endpoint.getNegativeResponseSchema(),
        true
      );
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
            mimeTypes: endpoint.getPositiveMimeTypes(),
            depictedSchema: positiveDepiction,
            examples: positiveExamples,
          }),
          "400": depictResponse({
            method: method as Method,
            path,
            description: errorResponseDescription,
            mimeTypes: endpoint.getNegativeMimeTypes(),
            depictedSchema: negativeDepiction,
            examples: negativeExamples,
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
          mimeTypes: endpoint.getInputMimeTypes(),
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
