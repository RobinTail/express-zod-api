import { IRouter, RequestHandler } from "express";
import createHttpError from "http-errors";
import { isProduction } from "./common-helpers";
import { CommonConfig } from "./config-type";
import { ContentType } from "./content-type";
import { Diagnostics } from "./diagnostics";
import { AbstractEndpoint } from "./endpoint";
import { CORSMethod, isMethod } from "./method";
import { OnEndpoint, walkRouting } from "./routing-walker";
import { ServeStatic } from "./serve-static";
import { GetLogger } from "./server-helpers";
import * as R from "ramda";

/**
 * @example { v1: { books: { ":bookId": getBookEndpoint } } }
 * @example { "v1/books/:bookId": getBookEndpoint }
 * @example { "get /v1/books/:bookId": getBookEndpoint }
 * @example { v1: { "patch /books/:bookId": changeBookEndpoint } }
 * @example { dependsOnMethod: { get: retrieveEndpoint, post: createEndpoint } }
 * @see CommonConfig.methodLikeRouteBehavior
 * */
export interface Routing {
  [K: string]: Routing | AbstractEndpoint | ServeStatic;
}

export type Parsers = Partial<Record<ContentType, RequestHandler[]>>;

interface InitProps {
  app: IRouter;
  getLogger: GetLogger;
  config: CommonConfig;
  routing: Routing;
  parsers?: Parsers;
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

const makeCorsHeaders = (accessMethods: CORSMethod[]) => ({
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": lineUp(accessMethods),
  "Access-Control-Allow-Headers": "content-type",
});

type Siblings = Map<CORSMethod, [RequestHandler[], AbstractEndpoint]>;

/** This fn exists to reduce the complexity of initRouting and to ensure the disposal of Diagnostics ASAP */
const collectSiblings = ({
  app,
  getLogger,
  config,
  routing,
  parsers,
}: InitProps) => {
  const doc = isProduction() ? undefined : new Diagnostics(getLogger());
  const familiar = new Map<string, Siblings>();
  const onEndpoint: OnEndpoint = (method, path, endpoint) => {
    doc?.check(endpoint, { method }, path);
    const matchingParsers = parsers?.[endpoint.requestType] || [];
    const value = R.pair(matchingParsers, endpoint);
    if (!familiar.has(path))
      familiar.set(path, new Map(config.cors ? [["options", value]] : []));
    familiar.get(path)?.set(method, value);
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
    for (const [method, [matchingParsers, endpoint]] of methods) {
      const handlers = matchingParsers
        .slice() // must be immutable
        .concat(async (request, response) => {
          const logger = getLogger(request);
          return endpoint.execute({ request, response, logger, config });
        });
      if (config.cors) {
        // issue #2706, must go before parsers:
        handlers.unshift(async (request, response, next) => {
          const logger = getLogger(request);
          const defaultHeaders = makeCorsHeaders(accessMethods);
          const headers =
            typeof config.cors === "function"
              ? await config.cors({ request, endpoint, logger, defaultHeaders })
              : defaultHeaders;
          response.set(headers);
          next();
        });
      }
      app[method](path, ...handlers);
    }
    if (config.wrongMethodBehavior === 404) continue;
    deprioritized.set(path, createWrongMethodHandler(accessMethods));
  }
  for (const [path, handler] of deprioritized) app.all(path, handler);
};
