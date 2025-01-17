import { IRouter, RequestHandler } from "express";
import { isProduction } from "./common-helpers.ts";
import { CommonConfig } from "./config-type.ts";
import { ContentType } from "./content-type.ts";
import { DependsOnMethod } from "./depends-on-method.ts";
import { Diagnostics } from "./diagnostics.ts";
import { AbstractEndpoint } from "./endpoint.ts";
import { AuxMethod, Method } from "./method.ts";
import { OnEndpoint, walkRouting } from "./routing-walker.ts";
import { ServeStatic } from "./serve-static.ts";
import { GetLogger } from "./server-helpers.ts";

export interface Routing {
  [SEGMENT: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export type Parsers = Partial<Record<ContentType, RequestHandler[]>>;

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
  const doc = new Diagnostics(getLogger());
  const corsedPaths = new Set<string>();
  const onEndpoint: OnEndpoint = (endpoint, path, method, siblingMethods) => {
    if (!isProduction()) doc.check(endpoint, { path, method });
    const matchingParsers = parsers?.[endpoint.getRequestType()] || [];
    const handler: RequestHandler = async (request, response) => {
      const logger = getLogger(request);
      if (config.cors) {
        const accessMethods: Array<Method | AuxMethod> = [
          method,
          ...(siblingMethods || []),
          "options",
        ];
        const methodsLine = accessMethods.join(", ").toUpperCase();
        const defaultHeaders: Record<string, string> = {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": methodsLine,
          "Access-Control-Allow-Headers": "content-type",
        };
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
  };
  walkRouting({ routing, onEndpoint, onStatic: app.use.bind(app) });
};
