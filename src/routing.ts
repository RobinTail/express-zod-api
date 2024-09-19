import { IRouter, RequestHandler } from "express";
import { CommonConfig } from "./config-type";
import { ContentType } from "./content-type";
import { DependsOnMethod } from "./depends-on-method";
import { AbstractEndpoint } from "./endpoint";
import { walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import { ChildLoggerExtractor } from "./server-helpers";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export type Parsers = Record<ContentType, RequestHandler[]>;

export const initRouting = ({
  app,
  getChildLogger,
  config: { cors, ...rest },
  routing,
  parsers,
}: {
  app: IRouter;
  getChildLogger: ChildLoggerExtractor;
  config: Pick<CommonConfig, "cors" | "inputSources">;
  routing: Routing;
  parsers?: Parsers;
}) =>
  walkRouting({
    routing,
    hasCors: !!cors,
    onEndpoint: (endpoint, path, method, siblingMethods) => {
      app[method](
        path,
        ...(parsers?.[endpoint.getRequestType()] || []),
        async (request, response) =>
          endpoint.execute({
            request,
            response,
            logger: getChildLogger(request),
            config: { cors, ...rest },
            siblingMethods,
          }),
      );
    },
    onStatic: (path, handler) => {
      app.use(path, handler);
    },
  });
