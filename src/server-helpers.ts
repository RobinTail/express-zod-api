import type fileUpload from "express-fileupload";
import { metaSymbol } from "./metadata";
import { loadPeer } from "./peer-helpers";
import { AbstractResultHandler } from "./result-handler";
import { ActualLogger } from "./logger-helpers";
import { CommonConfig, ServerConfig } from "./config-type";
import {
  ErrorRequestHandler,
  RequestHandler,
  Request,
  IRouter,
  IRoute,
} from "express";
import createHttpError, { isHttpError } from "http-errors";
import { lastResortHandler } from "./last-resort";
import { ResultHandlerError } from "./errors";
import { ensureError } from "./common-helpers";
import { monitor } from "./graceful-shutdown";
import { chain } from "ramda";

type ILayer = IRouter["stack"][number]; // not exposed by express
interface EquippedLayed extends ILayer {
  route: IRoute & { methods: object };
  matchers: unknown[];
}

type EquippedRequest = Request<
  unknown,
  unknown,
  unknown,
  unknown,
  { [metaSymbol]?: { logger: ActualLogger } }
>;

/** @desc Returns child logger for the given request (if configured) or the configured logger otherwise */
export type GetLogger = (request?: Request) => ActualLogger;

interface HandlerCreatorParams {
  errorHandler: AbstractResultHandler;
  getLogger: GetLogger;
}

export const createParserFailureHandler =
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

const findSupportedMethods = (path: string, routerStack?: ILayer[]) => {
  if (!routerStack) return [];
  const suitable = routerStack.filter(
    (layer): layer is EquippedLayed =>
      layer.route !== undefined &&
      "methods" in layer.route &&
      typeof layer.route.methods === "object" &&
      layer.route.methods !== null &&
      "matchers" in layer &&
      Array.isArray(layer.matchers),
  );
  const matching = suitable.filter(({ matchers }) =>
    matchers.some((fn) => {
      if (typeof fn !== "function") return false;
      try {
        return fn(path);
      } catch {}
    }),
  );
  return chain(
    ({ route: { methods } }) =>
      Object.keys(methods).map((method) => method.toUpperCase()),
    matching,
  );
};

export const createNotFoundHandler =
  ({ errorHandler, getLogger }: HandlerCreatorParams): RequestHandler =>
  async (request, response) => {
    const supportedMethods = findSupportedMethods(
      request.path,
      request.app?.router.stack,
    );
    const error = supportedMethods?.length
      ? createHttpError(405, `${request.method} is not allowed`, {
          headers: { Allowed: supportedMethods.join(", ") },
        })
      : createHttpError(404, `Can not ${request.method} ${request.path}`);
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
