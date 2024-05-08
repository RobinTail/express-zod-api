import { IRouter, RequestHandler } from "express";
import { CommonConfig } from "./config-type";
import { ContentType } from "./content-type";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { AbstractLogger } from "./logger";
import { metaSymbol } from "./metadata";
import { walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import { LocalResponse } from "./server-helpers";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export type Parsers = Record<ContentType, RequestHandler[]>;

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
  parsers?: Parsers;
}) =>
  walkRouting({
    routing,
    hasCors: !!config.cors,
    onEndpoint: (endpoint, path, method, siblingMethods) => {
      app[method](
        path,
        ...(parsers?.[endpoint.getRequestType()] || []),
        async (request, response: LocalResponse) =>
          endpoint.execute({
            request,
            response,
            logger: response.locals[metaSymbol]?.logger || rootLogger,
            config,
            siblingMethods,
          }),
      );
    },
    onStatic: (path, handler) => {
      app.use(path, handler);
    },
  });
