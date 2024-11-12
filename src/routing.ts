import { IRouter, RequestHandler } from "express";
import { CommonConfig } from "./config-type";
import { ContentType, contentTypes } from "./content-type";
import { assertJsonCompatible } from "./deep-checks";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { ActualLogger } from "./logger-helpers";
import { AuxMethod, Method } from "./method";
import { walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import { ChildLoggerExtractor } from "./server-helpers";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export type Parsers = Record<ContentType, RequestHandler[]>;

export const initRouting = ({
  app,
  rootLogger,
  getChildLogger,
  config,
  routing,
  parsers,
}: {
  app: IRouter;
  rootLogger: ActualLogger;
  getChildLogger: ChildLoggerExtractor;
  config: CommonConfig;
  routing: Routing;
  parsers?: Parsers;
}) => {
  const verified = new WeakSet<AbstractEndpoint>();
  const corsedPaths = new Set<string>();
  walkRouting({
    routing,
    onEndpoint: (endpoint, path, method, siblingMethods) => {
      const requestType = endpoint.getRequestType();
      if (!verified.has(endpoint)) {
        if (requestType === "json") {
          try {
            assertJsonCompatible(endpoint.getSchema("input"), "in");
          } catch (reason) {
            rootLogger.warn(
              "The final input schema of the endpoint contains an unsupported JSON payload type.",
              { path, method, reason },
            );
          }
        }
        for (const variant of ["positive", "negative"] as const) {
          if (endpoint.getMimeTypes(variant).includes(contentTypes.json)) {
            try {
              assertJsonCompatible(endpoint.getSchema(variant), "out");
            } catch (reason) {
              rootLogger.warn(
                `The final ${variant} response schema of the endpoint contains an unsupported JSON payload type.`,
                { path, method, reason },
              );
            }
          }
        }
        verified.add(endpoint);
      }
      const accessMethods = ([method] as Array<Method | AuxMethod>)
        .concat(siblingMethods || [])
        .concat("options")
        .join(", ")
        .toUpperCase();
      const defaultHeaders: Record<string, string> = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": accessMethods,
        "Access-Control-Allow-Headers": "content-type",
      };
      const matchingParsers = parsers?.[requestType] || [];
      const handler: RequestHandler = async (request, response) => {
        const logger = getChildLogger(request);
        if (config.cors) {
          const headers =
            typeof config.cors === "function"
              ? await config.cors({ request, endpoint, logger, defaultHeaders })
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
    onStatic: (path, handler) => {
      app.use(path, handler);
    },
  });
};
