import cors from "cors";
import { IRouter, RequestHandler } from "express";
import { isProduction } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { ContentType } from "./content-type";
import { DependsOnMethod } from "./depends-on-method";
import { Diagnostics } from "./diagnostics";
import { AbstractEndpoint } from "./endpoint";
import { AuxMethod, Method } from "./method";
import { OnEndpoint, walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import { GetLogger } from "./server-helpers";

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
    const accessMethods: Array<Method | AuxMethod> = [
      method,
      ...(siblingMethods || []),
      "options",
    ];
    const methodsLine = accessMethods.join(", ").toUpperCase();
    if (config.cors) {
      matchingParsers.push(
        cors((request, cb) =>
          cb(null, {
            methods: methodsLine,
            allowedHeaders: "content-type",
            ...(typeof config.cors === "function" &&
              config.cors({
                request,
                endpoint,
                logger: getLogger(request),
              })),
            preflightContinue: true,
          }),
        ),
      );
    }
    const handler: RequestHandler = async (request, response) => {
      const logger = getLogger(request);
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
