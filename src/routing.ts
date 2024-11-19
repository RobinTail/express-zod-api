import { IRouter, RequestHandler } from "express";
import { CommonConfig } from "./config-type";
import { ContentType } from "./content-type";
import { DependsOnMethod } from "./depends-on-method";
import { Diagnostics } from "./diagnostics";
import { AbstractEndpoint } from "./endpoint";
import { AuxMethod, Method } from "./method";
import { walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import { GetLogger } from "./server-helpers";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export type Parsers = Record<ContentType, RequestHandler[]>;

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
  const therapist = new Diagnostics();
  const corsedPaths = new Set<string>();
  walkRouting({
    routing,
    onStatic: (path, handler) => void app.use(path, handler),
    onEndpoint: (endpoint, path, method, siblingMethods) => {
      setImmediate(() => therapist.verify(endpoint, getLogger(), path, method));
      const accessMethods: Array<Method | AuxMethod> = [
        method,
        ...(siblingMethods || []),
        "options",
      ];
      const defaultHeaders: Record<string, string> = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": accessMethods.join(", ").toUpperCase(),
        "Access-Control-Allow-Headers": "content-type",
      };
      const matchingParsers = parsers?.[endpoint.getRequestType()] || [];
      const handler: RequestHandler = async (request, response) => {
        const logger = getLogger(request);
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
  });
};
