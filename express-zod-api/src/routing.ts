import type { IRouter, RequestHandler, IRouterMatcher } from "express";
import createHttpError from "http-errors";
import { isProduction } from "./common-helpers";
import type { CommonConfig } from "./config-type";
import { Diagnostics } from "./diagnostics";
import type { AbstractEndpoint } from "./endpoint";
import { isMethod, type CORSMethod } from "./method";
import { walkRouting, type OnEndpoint } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import type { GetLogger } from "./server-helpers";

/**
 * @example { v1: { books: { ":bookId": getBookEndpoint } } }
 * @example { "v1/books/:bookId": getBookEndpoint }
 * @example { "get /v1/books/:bookId": getBookEndpoint }
 * @example { v1: { "patch /books/:bookId": changeBookEndpoint } }
 * @example { dependsOnMethod: { get: retrieveEndpoint, post: createEndpoint } }
 * @see CommonConfig.recognizeMethodDependentRoutes
 * */
export interface Routing {
  [K: string]: Routing | AbstractEndpoint | ServeStatic;
}

interface InitProps {
  app: IRouter;
  getLogger: GetLogger;
  config: CommonConfig;
  routing: Routing;
}

const lineUp = (methods: CORSMethod[]) =>
  methods // auxiliary methods go last
    .sort((a, b) => +isMethod(b) - +isMethod(a) || a.localeCompare(b))
    .join(", ")
    .toUpperCase();

/** @link https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/405 */
export const createWrongMethodHandler =
  (allowedMethods: CORSMethod[]): RequestHandler =>
  ({ method }, res, next) => {
    const Allow = lineUp(allowedMethods);
    res.set({ Allow }); // in case of a custom errorHandler configured that does not care about headers in error
    const error = createHttpError(405, `${method} is not allowed`, {
      headers: { Allow },
    });
    next(error);
  };

type Siblings = Map<CORSMethod, AbstractEndpoint>;

/** This fn exists to reduce the complexity of initRouting and to ensure the disposal of Diagnostics ASAP */
const collectSiblings = ({ app, getLogger, config, routing }: InitProps) => {
  const doc = isProduction() ? undefined : new Diagnostics(getLogger());
  const familiar = new Map<string, Siblings>();
  const onEndpoint: OnEndpoint = (method, path, endpoint) => {
    doc?.check(method, path, endpoint);
    if (!familiar.has(path))
      familiar.set(path, new Map(config.cors ? [["options", endpoint]] : []));
    familiar.get(path)?.set(method, endpoint);
  };
  walkRouting({ routing, config, onEndpoint, onStatic: app.use.bind(app) });
  return familiar;
};

export const initRouting = ({ app, config, getLogger, ...rest }: InitProps) => {
  const familiar = collectSiblings({ app, getLogger, config, ...rest });
  const deprioritized = new Map<string, RequestHandler>();
  for (const [path, methods] of familiar) {
    const accessMethods = Array.from(methods.keys());
    /** @link https://github.com/RobinTail/express-zod-api/discussions/2791#discussioncomment-13745912 */
    if (accessMethods.includes("get")) accessMethods.push("head");
    for (const [method, endpoint] of methods) {
      const handlers: RequestHandler[] = [];
      if (config.cors) {
        handlers.push((request, response, next) => {
          response.set("Access-Control-Allow-Methods", lineUp(accessMethods));
          next();
        });
      }
      handlers.push(async (request, response) => {
        const logger = getLogger(request);
        return endpoint.execute({ request, response, logger, config });
      });
      /** @todo remove type assertion when merged: https://github.com/DefinitelyTyped/DefinitelyTyped/pull/75187 */
      const register: (path: string, ...handlers: RequestHandler[]) => IRouter =
        (app as IRouter & { query: IRouterMatcher<IRouter> })[method];
      register.call(app, path, ...handlers);
    }
    if (config.hintAllowedMethods === false) continue;
    deprioritized.set(path, createWrongMethodHandler(accessMethods));
  }
  for (const [path, handler] of deprioritized) app.all(path, handler);
};
