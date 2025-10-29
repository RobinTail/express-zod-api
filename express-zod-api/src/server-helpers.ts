import type fileUpload from "express-fileupload";
import { loadPeer } from "./peer-helpers.ts";
import { AbstractResultHandler } from "./result-handler.ts";
import { ActualLogger } from "./logger-helpers.ts";
import { CommonConfig, ServerConfig } from "./config-type.ts";
import { ErrorRequestHandler, RequestHandler, Request } from "express";
import createHttpError from "http-errors";
import { lastResortHandler } from "./last-resort.ts";
import { ResultHandlerError } from "./errors.ts";
import { ensureError } from "./common-helpers.ts";
import { monitor } from "./graceful-shutdown.ts";

// eslint-disable-next-line no-restricted-syntax -- substituted by TSDOWN
export const localsID = Symbol.for(process.env.TSDOWN_SELF!);

type EquippedRequest = Request<
  unknown,
  unknown,
  unknown,
  unknown,
  { [localsID]?: { logger: ActualLogger } }
>;

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
      error: ensureError(error),
      request,
      response,
      input: null,
      output: null,
      ctx: {},
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
      await errorHandler.execute({
        request,
        response,
        logger,
        error,
        input: null,
        output: null,
        ctx: {},
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
    await beforeUpload?.({ request, logger });
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

/** @since v22.13 the access logging can be customized and disabled */
export const createLoggingMiddleware =
  ({
    logger: parent,
    config: {
      childLoggerProvider,
      accessLogger = ({ method, path }, logger) =>
        logger.debug(`${method}: ${path}`),
    },
  }: {
    logger: ActualLogger;
    config: CommonConfig;
  }): RequestHandler =>
  async (request, response, next) => {
    const logger = (await childLoggerProvider?.({ request, parent })) || parent;
    accessLogger?.(request, logger);
    if (request.res)
      (request as EquippedRequest).res!.locals[localsID] = { logger };
    next();
  };

export const makeGetLogger =
  (fallback: ActualLogger): GetLogger =>
  (request) =>
    (request as EquippedRequest | undefined)?.res?.locals[localsID]?.logger ||
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
  options: { timeout, beforeExit, events = ["SIGINT", "SIGTERM"] },
}: {
  servers: Parameters<typeof monitor>[0];
  options: Extract<ServerConfig["gracefulShutdown"], object>;
  logger: ActualLogger;
}) => {
  const graceful = monitor(servers, { logger, timeout });
  const onTerm = async () => {
    await graceful.shutdown();
    await beforeExit?.();
    process.exit();
  };
  for (const trigger of events) process.on(trigger, onTerm);
};
