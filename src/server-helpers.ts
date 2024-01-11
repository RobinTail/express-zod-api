import { AnyResultHandlerDefinition } from "./result-handler";
import { AbstractLogger } from "./logger";
import { CommonConfig } from "./config-type";
import { ErrorRequestHandler, RequestHandler } from "express";
import createHttpError from "http-errors";
import { lastResortHandler } from "./last-resort";
import { ResultHandlerError } from "./errors";
import { makeErrorFromAnything } from "./common-helpers";

interface HandlerCreatorParams {
  errorHandler: AnyResultHandlerDefinition;
  rootLogger: AbstractLogger;
  childLoggerProvider: CommonConfig["childLoggerProvider"];
}

export const createParserFailureHandler =
  ({
    errorHandler,
    rootLogger,
    childLoggerProvider,
  }: HandlerCreatorParams): ErrorRequestHandler =>
  async (error, request, response, next) => {
    if (!error) {
      return next();
    }
    errorHandler.handler({
      error: createHttpError(400, makeErrorFromAnything(error).message),
      request,
      response,
      input: null,
      output: null,
      logger: childLoggerProvider
        ? await childLoggerProvider({ request, logger: rootLogger })
        : rootLogger,
    });
  };

export const createNotFoundHandler =
  ({
    errorHandler,
    childLoggerProvider,
    rootLogger,
  }: HandlerCreatorParams): RequestHandler =>
  async (request, response) => {
    const error = createHttpError(
      404,
      `Can not ${request.method} ${request.path}`,
    );
    const logger = childLoggerProvider
      ? await childLoggerProvider({ request, logger: rootLogger })
      : rootLogger;
    try {
      errorHandler.handler({
        request,
        response,
        logger,
        error,
        input: null,
        output: null,
      });
    } catch (e) {
      lastResortHandler({
        response,
        logger,
        error: new ResultHandlerError(makeErrorFromAnything(e).message, error),
      });
    }
  };
