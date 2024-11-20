import { IRouter, RequestHandler } from "express";
import { isProduction } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { ContentType, contentTypes } from "./content-type";
import { assertJsonCompatible } from "./deep-checks";
import { DependsOnMethod } from "./depends-on-method";
import { Diagnostics } from "./diagnostics";
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
  const doc = new Diagnostics();
  walkRouting({
    routing,
    hasCors: !!config.cors,
    onEndpoint: (endpoint, path, method, siblingMethods) => {
      if (!isProduction()) doc.check(endpoint, rootLogger, { path, method });
      app[method](
        path,
        ...(parsers?.[endpoint.getRequestType()] || []),
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
