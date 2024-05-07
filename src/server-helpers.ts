import { AnyResultHandlerDefinition } from "./result-handler";
import { AbstractLogger } from "./logger";
import { CommonConfig } from "./config-type";
import { ErrorRequestHandler, RequestHandler, Response } from "express";
import createHttpError, { isHttpError } from "http-errors";
import { lastResortHandler } from "./last-resort";
import { ResultHandlerError } from "./errors";
import { makeErrorFromAnything } from "./common-helpers";

interface HandlerCreatorParams {
  errorHandler: AnyResultHandlerDefinition;
  rootLogger: AbstractLogger;
  getChildLogger: CommonConfig["childLoggerProvider"];
}

export type LocalResponse = Response<unknown, { logger?: AbstractLogger }>;

export const createParserFailureHandler =
  ({
    errorHandler,
    rootLogger,
    getChildLogger,
  }: HandlerCreatorParams): ErrorRequestHandler =>
  async (error, request, response, next) => {
    if (!error) {
      return next();
    }
    errorHandler.handler({
      error: isHttpError(error)
        ? error
        : createHttpError(400, makeErrorFromAnything(error).message),
      request,
      response,
      input: null,
      output: null,
      options: {},
      logger: getChildLogger
        ? await getChildLogger({ request, parent: rootLogger })
        : rootLogger,
    });
  };

export const createNotFoundHandler =
  ({
    errorHandler,
    getChildLogger,
    rootLogger,
  }: HandlerCreatorParams): RequestHandler =>
  async (request, response) => {
    const error = createHttpError(
      404,
      `Can not ${request.method} ${request.path}`,
    );
    const logger = getChildLogger
      ? await getChildLogger({ request, parent: rootLogger })
      : rootLogger;
    try {
      errorHandler.handler({
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
        error: new ResultHandlerError(makeErrorFromAnything(e).message, error),
      });
    }
  };

export const createUploadFailueHandler =
  (error: Error): RequestHandler =>
  (req, {}, next) => {
    const failedFile = Object.values(req?.files || [])
      .flat()
      .find(({ truncated }) => truncated);
    if (failedFile) {
      return next(error);
    }
    next();
  };

// @todo revert to using the logger.debug.bind
export const createUploadLogger = (
  logger: AbstractLogger,
): Pick<Console, "log"> => ({
  log: (message, ...rest) => {
    if (!/not eligible/.test(message)) {
      logger.debug(message, ...rest);
    }
  },
});

export const rawMover: RequestHandler = (req, {}, next) => {
  if (Buffer.isBuffer(req.body)) {
    req.body = { raw: req.body };
  }
  next();
};

/** @since v19 prints the actual path of the request, not a configured route */
export const createLoggingMiddleware =
  ({
    rootLogger,
    config,
  }: {
    rootLogger: AbstractLogger;
    config: CommonConfig;
  }): RequestHandler =>
  async (request, response: LocalResponse, next) => {
    const logger = config.childLoggerProvider
      ? await config.childLoggerProvider({ request, parent: rootLogger })
      : rootLogger;
    logger.info(`${request.method}: ${request.path}`);
    response.locals.logger = logger;
    next();
  };
