import { IRouter, RequestHandler } from "express";
import createHttpError from "http-errors";
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
  const familiar = new Map<string, Array<Method | AuxMethod>>();
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
    if (!familiar.has(path)) {
      familiar.set(path, []);
      if (config.cors) {
        app.options(path, ...matchingParsers, handler);
        familiar.get(path)?.push("options");
      }
    }
    familiar.get(path)?.push(method);
    app[method](path, ...matchingParsers, handler);
  };
  walkRouting({ routing, onEndpoint, onStatic: app.use.bind(app) });
  if (config.wrongMethodBehavior !== 405) return;
  for (const [path, allowedMethods] of familiar.entries()) {
    app.all(path, ({ method }, res, next) =>
      next(
        allowedMethods &&
          createHttpError(405, `${method} is not allowed`, {
            headers: { Allowed: allowedMethods.join(", ").toUpperCase() },
          }),
      ),
    );
  }
};
