import type fileUpload from "express-fileupload";
import { ContentType } from "./content-type";
import { Diagnostics } from "./diagnostics";
import { metaSymbol } from "./metadata";
import { AuxMethod, Method } from "./method";
import { loadPeer } from "./peer-helpers";
import { AbstractResultHandler } from "./result-handler";
import { ActualLogger } from "./logger-helpers";
import { CommonConfig, ServerConfig } from "./config-type";
import { ErrorRequestHandler, RequestHandler, Request, IRouter } from "express";
import createHttpError, { isHttpError } from "http-errors";
import { lastResortHandler } from "./last-resort";
import { ResultHandlerError } from "./errors";
import { ensureError, isProduction } from "./common-helpers";
import { monitor } from "./graceful-shutdown";
import { Routing } from "./routing";
import { OnEndpoint, walkRouting } from "./routing-walker";

type EquippedRequest = Request<
  unknown,
  unknown,
  unknown,
  unknown,
  { [metaSymbol]?: { logger: ActualLogger } }
>;

export type Parsers = Partial<Record<ContentType, RequestHandler[]>>;

/** @desc Returns child logger for the given request (if configured) or the configured logger otherwise */
export type GetLogger = (request?: Request) => ActualLogger;

interface HandlerCreatorParams {
  errorHandler: AbstractResultHandler;
  getLogger: GetLogger;
}

export const createCatcher =
  ({ errorHandler, getLogger }: HandlerCreatorParams): ErrorRequestHandler =>
  async (error, request, response, next) => {
    if (!error) return next();
    return errorHandler.execute({
      error: isHttpError(error)
        ? error
        : createHttpError(400, ensureError(error).message),
      request,
      response,
      input: null,
      output: null,
      options: {},
      logger: getLogger(request),
    });
  };

export const createNotFoundHandler =
  ({ errorHandler, getLogger }: HandlerCreatorParams): RequestHandler =>
  async (request, response) => {
    const error = createHttpError(
      404,
      `Can not ${request.method} ${request.path}`,
    );
    const logger = getLogger(request);
    try {
      errorHandler.execute({
        request,
        response,
        logger,
        error,
        input: null,
        output: null,
        options: {},
      });
    } catch (e) {
      lastResortHandler({
        response,
        logger,
        error: new ResultHandlerError(ensureError(e), error),
      });
    }
  };

export const createUploadFailureHandler =
  (error: Error): RequestHandler =>
  (req, {}, next) => {
    const failedFile = Object.values(req?.files || [])
      .flat()
      .find(({ truncated }) => truncated);
    if (failedFile) return next(error);
    next();
  };

export const createUploadLogger = (
  logger: ActualLogger,
): Pick<Console, "log"> => ({ log: logger.debug.bind(logger) });

export const createUploadParsers = async ({
  getLogger,
  config,
}: {
  getLogger: GetLogger;
  config: ServerConfig;
}): Promise<RequestHandler[]> => {
  const uploader = await loadPeer<typeof fileUpload>("express-fileupload");
  const { limitError, beforeUpload, ...options } = {
    ...(typeof config.upload === "object" && config.upload),
  };
  const parsers: RequestHandler[] = [];
  parsers.push(async (request, response, next) => {
    const logger = getLogger(request);
    try {
      await beforeUpload?.({ request, logger });
    } catch (error) {
      return next(error);
    }
    return uploader({
      debug: true,
      ...options,
      abortOnLimit: false,
      parseNested: true,
      logger: createUploadLogger(logger),
    })(request, response, next);
  });
  if (limitError) parsers.push(createUploadFailureHandler(limitError));
  return parsers;
};

export const moveRaw: RequestHandler = (req, {}, next) => {
  if (Buffer.isBuffer(req.body)) req.body = { raw: req.body };
  next();
};

/** @since v19 prints the actual path of the request, not a configured route, severity decreased to debug level */
export const createLoggingMiddleware =
  ({
    logger: parent,
    config,
  }: {
    logger: ActualLogger;
    config: CommonConfig;
  }): RequestHandler =>
  async (request, response, next) => {
    const logger =
      (await config.childLoggerProvider?.({ request, parent })) || parent;
    logger.debug(`${request.method}: ${request.path}`);
    if (request.res)
      (request as EquippedRequest).res!.locals[metaSymbol] = { logger };
    next();
  };

export const makeGetLogger =
  (fallback: ActualLogger): GetLogger =>
  (request) =>
    (request as EquippedRequest | undefined)?.res?.locals[metaSymbol]?.logger ||
    fallback;

export const installDeprecationListener = (logger: ActualLogger) =>
  process.on("deprecation", ({ message, namespace, name, stack }) =>
    logger.warn(
      `${name} (${namespace}): ${message}`,
      stack.split("\n").slice(1),
    ),
  );

export const installTerminationListener = ({
  servers,
  logger,
  options: { timeout, events = ["SIGINT", "SIGTERM"] },
}: {
  servers: Parameters<typeof monitor>[0];
  options: Extract<ServerConfig["gracefulShutdown"], object>;
  logger: ActualLogger;
}) => {
  const graceful = monitor(servers, { logger, timeout });
  const onTerm = () => graceful.shutdown().then(() => process.exit());
  for (const trigger of events) process.on(trigger, onTerm);
};

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
  const onEndpoint: OnEndpoint = (endpoint, path, method, siblingMethods) => {
    if (!isProduction()) {
      doc?.checkJsonCompat(endpoint, { path, method });
      doc?.checkPathParams(path, endpoint, { method });
    }
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
  doc = undefined; // hint for garbage collector
  if (config.wrongMethodBehavior !== 405) return;
  for (const [path, allowedMethods] of familiar.entries())
    app.all(path, createWrongMethodHandler(allowedMethods));
};
