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

/**
 * @example { v1: { books: { ":bookId": getBookEndpoint } } }
 * @example { "v1/books/:bookId": getBookEndpoint }
 * @example { "get /v1/books/:bookId": getBookEndpoint }
 * @example { v1: { "patch /books/:bookId": changeBookEndpoint } }
 * */
export interface Routing {
  [K: string]: Routing | DependsOnMethod | AbstractEndpoint | ServeStatic;
}

export type Parsers = Partial<Record<ContentType, RequestHandler[]>>;

/** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405 */
export const createWrongMethodHandler =
  (allowedMethods: Array<Method | AuxMethod>): RequestHandler =>
  ({ method }, res, next) => {
    const Allow = allowedMethods.join(", ").toUpperCase();
    res.set({ Allow }); // in case of a custom errorHandler configured that does not care about headers in error
    const error = createHttpError(405, `${method} is not allowed`, {
      headers: { Allow },
    });
    next(error);
  };

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
  let doc = isProduction() ? undefined : new Diagnostics(getLogger()); // disposable
  const familiar = new Map<string, Array<Method | AuxMethod>>();
  const onEndpoint: OnEndpoint = (endpoint, path, method) => {
    if (!isProduction()) {
      doc?.checkJsonCompat(endpoint, { path, method });
      doc?.checkPathParams(path, endpoint, { method });
    }
    const matchingParsers = parsers?.[endpoint.requestType] || [];
    const handler: RequestHandler = async (request, response) => {
      const logger = getLogger(request);
      // @todo move
      /*
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
      }*/
      return endpoint.execute({ request, response, logger, config });
    };
    if (!familiar.has(path)) {
      familiar.set(path, []);
      // @todo move
      if (config.cors) {
        app.options(path, ...matchingParsers, handler);
        familiar.get(path)?.push("options");
      }
    }
    familiar.get(path)?.push(method);
    app[method](path, ...matchingParsers, handler);
  };
  walkRouting({ routing, onEndpoint, onStatic: app.use.bind(app) });
  doc = undefined; // hint for garbage collector
  if (config.wrongMethodBehavior === 404) return;
  for (const [path, allowedMethods] of familiar.entries())
    app.all(path, createWrongMethodHandler(allowedMethods));
};
