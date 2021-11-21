import {
  ContentObject,
  OpenApiBuilder,
  OperationObject,
  SchemaObject,
} from "openapi3-ts";
import { getRoutePathParams } from "./common-helpers";
import { Method } from "./method";
import {
  describeIOExamples,
  describeParams,
  describeSchema,
  excludeParamFromDescription,
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
    const cb: RoutingCycleParams["cb"] = (endpoint, fullPath, method) => {
      const positiveResponseSchema = describeSchema(
        endpoint.getPositiveResponseSchema(),
        true
      );
      delete positiveResponseSchema.example;
      const negativeResponseSchema = describeSchema(
        endpoint.getNegativeResponseSchema(),
        true
      );
      delete negativeResponseSchema.example;
      const operation: OperationObject = {
        responses: {
          "200": {
            description: `${method.toUpperCase()} ${fullPath} ${successfulResponseDescription}`,
            content: endpoint.getPositiveMimeTypes().reduce(
              (carry, mimeType) => ({
                ...carry,
                [mimeType]: {
                  schema: positiveResponseSchema,
                  ...describeIOExamples(
                    endpoint.getPositiveResponseSchema(),
                    true
                  ),
                },
              }),
              {} as ContentObject
            ),
          },
          "400": {
            description: `${method.toUpperCase()} ${fullPath} ${errorResponseDescription}`,
            content: endpoint.getNegativeMimeTypes().reduce(
              (carry, mimeType) => ({
                ...carry,
                [mimeType]: {
                  schema: negativeResponseSchema,
                  ...describeIOExamples(
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
      operation.parameters = describeParams(
        fullPath,
        method as Method,
        endpoint.getInputSchema()
      );
      if (method !== "get") {
        const bodySchema = describeSchema(endpoint.getInputSchema(), false);
        delete bodySchema.example;
        for (const pathParam of getRoutePathParams(fullPath)) {
          excludeParamFromDescription(bodySchema, pathParam);
          if (bodySchema.allOf) {
            bodySchema.allOf.forEach((obj: SchemaObject) =>
              excludeParamFromDescription(obj, pathParam)
            );
          }
          if (bodySchema.oneOf) {
            bodySchema.oneOf.forEach((obj: SchemaObject) =>
              excludeParamFromDescription(obj, pathParam)
            );
          }
        }
        operation.requestBody = {
          content: endpoint.getInputMimeTypes().reduce(
            (carry, mimeType) => ({
              ...carry,
              [mimeType]: {
                schema: {
                  description: `${method.toUpperCase()} ${fullPath} request body`,
                  ...bodySchema,
                },
                ...describeIOExamples(
                  endpoint.getInputSchema(),
                  false,
                  getRoutePathParams(fullPath)
                ),
              },
            }),
            {} as ContentObject
          ),
        };
      }
      this.addPath(fullPath, {
        ...(this.rootDoc.paths?.[fullPath] || {}),
        [method]: operation,
      });
    };
    routingCycle({ routing, cb });
  }
}
