import express, { ErrorRequestHandler, RequestHandler } from "express";
import compression from "compression";
import fileUpload from "express-fileupload";
import https from "node:https";
import { Logger } from "winston";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { ResultHandlerError } from "./errors";
import { isLoggerConfig, makeErrorFromAnything } from "./common-helpers";
import { createLogger } from "./logger";
import {
  AnyResultHandlerDefinition,
  defaultResultHandler,
  lastResortHandler,
} from "./result-handler";
import { Routing, initRouting } from "./routing";
import createHttpError from "http-errors";

export const createParserFailureHandler =
  (
    errorHandler: AnyResultHandlerDefinition,
    logger: Logger,
  ): ErrorRequestHandler =>
  (error, request, response, next) => {
    if (!error) {
      return next();
    }
    errorHandler.handler({
      error: createHttpError(400, makeErrorFromAnything(error).message),
      request,
      response,
      logger,
      input: null,
      output: null,
    });
  };

export const createNotFoundHandler =
  (errorHandler: AnyResultHandlerDefinition, logger: Logger): RequestHandler =>
  (request, response) => {
    const error = createHttpError(
      404,
      `Can not ${request.method} ${request.path}`,
    );
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

export const attachRouting = (
  config: AppConfig & CommonConfig,
  routing: Routing,
) => {
  const logger = isLoggerConfig(config.logger)
    ? createLogger(config.logger)
    : config.logger;
  initRouting({ app: config.app, routing, logger, config });
  const errorHandler = config.errorHandler || defaultResultHandler;
  const notFoundHandler = createNotFoundHandler(errorHandler, logger);
  return { notFoundHandler, logger };
};

export const createServer = (
  config: ServerConfig & CommonConfig,
  routing: Routing,
) => {
  const logger = isLoggerConfig(config.logger)
    ? createLogger(config.logger)
    : config.logger;
  const app = express().disable("x-powered-by");

  if (config.server.compression) {
    app.use(
      compression(
        typeof config.server.compression === "object"
          ? config.server.compression
          : {},
      ),
    );
  }
  app.use(config.server.jsonParser || express.json());
  if (config.server.upload) {
    app.use(
      fileUpload({
        ...(typeof config.server.upload === "object"
          ? config.server.upload
          : {}),
        abortOnLimit: false,
        parseNested: true,
      }),
    );
  }

  const errorHandler = config.errorHandler || defaultResultHandler;
  app.use(createParserFailureHandler(errorHandler, logger));
  initRouting({ app, routing, logger, config });
  app.use(createNotFoundHandler(errorHandler, logger));

  const httpServer = app.listen(config.server.listen, () => {
    logger.info(`Listening ${config.server.listen}`);
  });

  let httpsServer: https.Server | undefined;
  if (config.https) {
    httpsServer = https
      .createServer(config.https.options, app)
      .listen(config.https.listen, () => {
        logger.info(`Listening ${config.https!.listen}`);
      });
  }

  return { app, httpServer, httpsServer, logger };
};
