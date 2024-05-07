import { IRouter, RequestHandler } from "express";
import { CommonConfig } from "./config-type";
import { ContentType } from "./content-type";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { AbstractLogger } from "./logger";
import { walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export const initRouting = ({
  app,
  rootLogger,
  config,
  routing,
  parsers,
}: {
  app: IRouter;
  rootLogger: AbstractLogger;
  config: CommonConfig;
  routing: Routing;
  parsers?: Record<ContentType, RequestHandler[]>;
}) =>
  walkRouting({
    routing,
    hasCors: !!config.cors,
    onEndpoint: (endpoint, path, method, siblingMethods) => {
      // @todo skip for "options" method?
      const middlewares = parsers?.[endpoint.getRequestType()] || [];
      if (middlewares.length) {
        app.use(path, middlewares);
      }
      app[method](path, async (request, response) => {
        const logger = config.childLoggerProvider
          ? await config.childLoggerProvider({ request, parent: rootLogger })
          : rootLogger;
        logger.info(`${request.method}: ${path}`);
        await endpoint.execute({
          request,
          response,
          logger,
          config,
          siblingMethods,
        });
      });
    },
    onStatic: (path, handler) => {
      app.use(path, handler);
    },
  });
