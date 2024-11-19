import { IRouter, RequestHandler } from "express";
import { CommonConfig } from "./config-type";
import { ContentType, contentTypes } from "./content-type";
import { assertJsonCompatible } from "./deep-checks";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { AuxMethod, Method } from "./method";
import { walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import { GetLogger } from "./server-helpers";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export type Parsers = Record<ContentType, RequestHandler[]>;

class Verifier {
  #verified = new WeakSet<AbstractEndpoint>();
  public verify(
    endpoint: AbstractEndpoint,
    logger: ReturnType<GetLogger>,
    path: string,
    method: Method,
  ) {
    if (!this.#verified.has(endpoint)) {
      if (endpoint.getRequestType() === "json") {
        try {
          assertJsonCompatible(endpoint.getSchema("input"), "in");
        } catch (reason) {
          logger.warn(
            "The final input schema of the endpoint contains an unsupported JSON payload type.",
            { path, method, reason },
          );
        }
      }
      for (const variant of ["positive", "negative"] as const) {
        for (const { mimeTypes, schema } of endpoint.getResponses(variant)) {
          if (mimeTypes.includes(contentTypes.json)) {
            try {
              assertJsonCompatible(schema, "out");
            } catch (reason) {
              logger.warn(
                `The final ${variant} response schema of the endpoint contains an unsupported JSON payload type.`,
                { path, method, reason },
              );
            }
          }
        }
      }
      this.#verified.add(endpoint);
    }
  }
}

export const initRouting = ({
  app,
  getLogger,
  config,
  routing,
  parsers,
}: {
  app: IRouter;
  getLogger: GetLogger;
  config: CommonConfig;
  routing: Routing;
  parsers?: Parsers;
}) => {
  const verifier = new Verifier();
  const corsedPaths = new Set<string>();
  walkRouting({
    routing,
    onStatic: (path, handler) => void app.use(path, handler),
    onEndpoint: [
      (endpoint, path, method) =>
        setImmediate(() =>
          verifier.verify(endpoint, getLogger(), path, method),
        ),
      (endpoint, path, method, siblingMethods) => {
        const accessMethods: Array<Method | AuxMethod> = [
          method,
          ...(siblingMethods || []),
          "options",
        ];
        const defaultHeaders: Record<string, string> = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": accessMethods
            .join(", ")
            .toUpperCase(),
          "Access-Control-Allow-Headers": "content-type",
        };
        const matchingParsers = parsers?.[endpoint.getRequestType()] || [];
        const handler: RequestHandler = async (request, response) => {
          const logger = getLogger(request);
          if (config.cors) {
            const headers =
              typeof config.cors === "function"
                ? await config.cors({
                    request,
                    endpoint,
                    logger,
                    defaultHeaders,
                  })
                : defaultHeaders;
            for (const key in headers) response.set(key, headers[key]);
          }
          return endpoint.execute({ request, response, logger, config });
        };
        if (config.cors && !corsedPaths.has(path)) {
          app.options(path, ...matchingParsers, handler);
          corsedPaths.add(path);
        }
        app[method](path, ...matchingParsers, handler);
      },
    ],
  });
};
