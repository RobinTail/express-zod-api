import type fileUpload from "express-fileupload";
import { metaSymbol } from "./metadata";
import { loadPeer } from "./peer-helpers";
import { AbstractResultHandler } from "./result-handler";
import { ActualLogger } from "./logger-helpers";
import { CommonConfig, ServerConfig } from "./config-type";
import { ErrorRequestHandler, RequestHandler, Request } from "express";
import createHttpError from "http-errors";
import { lastResortHandler } from "./last-resort";
import { ResultHandlerError } from "./errors";
import { ensureError } from "./common-helpers";
import { monitor } from "./graceful-shutdown";

type EquippedRequest = Request<
  unknown,
  unknown,
  unknown,
  unknown,
  { [metaSymbol]?: { logger: ActualLogger } }
>;

export type ChildLoggerExtractor = (request: Request) => ActualLogger;

interface HandlerCreatorParams {
  errorHandler: AbstractResultHandler;
  getChildLogger: ChildLoggerExtractor;
}

export const createParserFailureHandler =
  ({
    errorHandler,
    getChildLogger,
  }: HandlerCreatorParams): ErrorRequestHandler =>
  async (error, request, response, next) => {
    if (!error) return next();
    return errorHandler.execute({
      error: ensureError(error),
      request,
      response,
      input: null,
      output: null,
      options: {},
      logger: getChildLogger(request),
    });
  };

export const createNotFoundHandler =
  ({ errorHandler, getChildLogger }: HandlerCreatorParams): RequestHandler =>
  async (request, response) => {
    const error = createHttpError(
      404,
      `Can not ${request.method} ${request.path}`,
    );
    const logger = getChildLogger(request);
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
  getChildLogger,
  config,
}: {
  getChildLogger: ChildLoggerExtractor;
  config: ServerConfig;
}): Promise<RequestHandler[]> => {
  const uploader = await loadPeer<typeof fileUpload>("express-fileupload");
  const { limitError, beforeUpload, ...options } = {
    ...(typeof config.server.upload === "object" && config.server.upload),
  };
  const parsers: RequestHandler[] = [];
  parsers.push(async (request, response, next) => {
    const logger = getChildLogger(request);
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
    rootLogger,
    config,
  }: {
    rootLogger: ActualLogger;
    config: CommonConfig;
  }): RequestHandler =>
  async (request, response, next) => {
    const logger = config.childLoggerProvider
      ? await config.childLoggerProvider({ request, parent: rootLogger })
      : rootLogger;
    logger.debug(`${request.method}: ${request.path}`);
    if (request.res)
      (request as EquippedRequest).res!.locals[metaSymbol] = { logger };
    next();
  };

export const makeChildLoggerExtractor =
  (fallback: ActualLogger): ChildLoggerExtractor =>
  (request) =>
    (request as EquippedRequest).res?.locals[metaSymbol]?.logger || fallback;

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
