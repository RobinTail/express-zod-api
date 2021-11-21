import {
  ContentObject,
  OpenApiBuilder,
  OperationObject,
  SchemaObject,
} from "openapi3-ts";
import { getRoutePathParams } from "./common-helpers";
import { Method } from "./method";
import {
  depictIOExamples,
  depictParams,
  depictSchema,
  excludeParamFromDepiction,
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
      const positiveResponseSchema = depictSchema({
        schema: endpoint.getPositiveResponseSchema(),
        isResponse: true,
      });
      delete positiveResponseSchema.example;
      const negativeResponseSchema = depictSchema({
        schema: endpoint.getNegativeResponseSchema(),
        isResponse: true,
      });
      delete negativeResponseSchema.example;
      const operation: OperationObject = {
        responses: {
          "200": {
            description: `${method.toUpperCase()} ${path} ${successfulResponseDescription}`,
            content: endpoint.getPositiveMimeTypes().reduce(
              (carry, mimeType) => ({
                ...carry,
                [mimeType]: {
                  schema: positiveResponseSchema,
                  ...depictIOExamples(
                    endpoint.getPositiveResponseSchema(),
                    true
                  ),
                },
              }),
              {} as ContentObject
            ),
          },
          "400": {
            description: `${method.toUpperCase()} ${path} ${errorResponseDescription}`,
            content: endpoint.getNegativeMimeTypes().reduce(
              (carry, mimeType) => ({
                ...carry,
                [mimeType]: {
                  schema: negativeResponseSchema,
                  ...depictIOExamples(
                    endpoint.getNegativeResponseSchema(),
                    true
                  ),
                },
              }),
              {} as ContentObject
            ),
          },
        },
      };
      if (endpoint.getDescription()) {
        operation.description = endpoint.getDescription();
      }
      const pathParams = getRoutePathParams(path);
      const depictedParams = depictParams(
        path,
        method as Method,
        endpoint.getInputSchema()
      );
      if (depictedParams.length > 0) {
        operation.parameters = depictedParams;
      }
      if (method !== "get") {
        const bodySchema = depictSchema({
          schema: endpoint.getInputSchema(),
          isResponse: false,
        });
        delete bodySchema.example;
        for (const pathParam of pathParams) {
          excludeParamFromDepiction(bodySchema, pathParam);
          if (bodySchema.allOf) {
            bodySchema.allOf.forEach((obj: SchemaObject) =>
              excludeParamFromDepiction(obj, pathParam)
            );
          }
          if (bodySchema.oneOf) {
            bodySchema.oneOf.forEach((obj: SchemaObject) =>
              excludeParamFromDepiction(obj, pathParam)
            );
          }
        }
        operation.requestBody = {
          content: endpoint.getInputMimeTypes().reduce(
            (carry, mimeType) => ({
              ...carry,
              [mimeType]: {
                schema: {
                  description: `${method.toUpperCase()} ${path} request body`,
                  ...bodySchema,
                },
                ...depictIOExamples(
                  endpoint.getInputSchema(),
                  false,
                  pathParams
                ),
              },
            }),
            {} as ContentObject
          ),
        };
      }
      this.addPath(path, {
        ...(this.rootDoc.paths?.[path] || {}),
        [method]: operation,
      });
    };
    routingCycle({ routing, cb });
  }
}
