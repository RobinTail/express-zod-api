import { IRouter, RequestHandler } from "express";
import { CommonConfig } from "./config-type";
import { ContentType, contentTypes } from "./content-type";
import { hasJsonIncompatibleSchema } from "./deep-checks";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { ActualLogger } from "./logger-helpers";
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
  walkRouting({
    routing,
    hasCors: !!config.cors,
    onEndpoint: (endpoint, path, method, siblingMethods) => {
      const requestType = endpoint.getRequestType();
      if (!verified.has(endpoint)) {
        if (
          requestType === "json" &&
          hasJsonIncompatibleSchema(endpoint.getSchema("input"), false)
        ) {
          rootLogger.warn(
            "The input endpoint schema (including middlewares) contains an unsupported JSON payload type.",
            { path, method },
          );
        }
        for (const variant of ["positive", "negative"] as const) {
          if (
            endpoint.getMimeTypes(variant).includes(contentTypes.json) &&
            hasJsonIncompatibleSchema(endpoint.getSchema(variant), true)
          ) {
            rootLogger.warn(
              `The ${variant} response endpoint schema (including ResultHandler) contains an unsupported JSON payload type.`,
              { path, method },
            );
          }
        }
        verified.add(endpoint);
      }
      app[method](
        path,
        ...(parsers?.[requestType] || []),
        async (request, response) =>
          endpoint.execute({
            request,
            response,
            logger: getChildLogger(request),
            config,
            siblingMethods,
          }),
      );
    },
    onStatic: (path, handler) => {
      app.use(path, handler);
    },
  });
};
