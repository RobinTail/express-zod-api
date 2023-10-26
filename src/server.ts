import express, { ErrorRequestHandler, RequestHandler } from "express";
import compression from "compression";
import fileUpload from "express-fileupload";
import https from "node:https";
import { Logger } from "winston";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { ResultHandlerError } from "./errors";
import { makeErrorFromAnything } from "./common-helpers";
import { createLogger } from "./logger";
import {
  AnyResultHandlerDefinition,
  defaultResultHandler,
  lastResortHandler,
} from "./result-handler";
import { Routing, initRouting } from "./routing";
import createHttpError from "http-errors";
import process from "node:process";

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

const makeCommonEntities = (config: CommonConfig) => {
  const logger =
    config.logger instanceof Logger
      ? config.logger
      : createLogger(config.logger);
  const errorHandler = config.errorHandler || defaultResultHandler;
  const notFoundHandler = createNotFoundHandler(errorHandler, logger);
  return { logger, errorHandler, notFoundHandler };
};

export const attachRouting = (
  config: AppConfig & CommonConfig,
  routing: Routing,
) => {
  const { logger, notFoundHandler } = makeCommonEntities(config);
  initRouting({ app: config.app, routing, logger, config });
  return { notFoundHandler, logger };
};

export const createServer = (
  config: ServerConfig & CommonConfig,
  routing: Routing,
) => {
  const app = express().disable("x-powered-by");
  if (config.server.compression) {
    app.use(
      compression(
        typeof config.server.compression === "object"
          ? config.server.compression
          : undefined,
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

  const { logger, errorHandler, notFoundHandler } = makeCommonEntities(config);
  app.use(createParserFailureHandler(errorHandler, logger));
  initRouting({ app, routing, logger, config });
  app.use(notFoundHandler);

  const httpServer = app.listen(config.server.listen, () => {
    logger.info(`Listening ${config.server.listen}`);
  });
  const httpsServer = config.https
    ? https
        .createServer(config.https.options, app)
        .listen(config.https.listen, () => {
          logger.info(`Listening ${config.https!.listen}`);
        })
    : undefined;

  const terminator = (signal: NodeJS.Signals) => {
    logger.info(`Closing by ${signal}...`);
    const shutdowns = [new Promise((resolve) => httpServer.close(resolve))];
    if (httpsServer) {
      shutdowns.push(new Promise((resolve) => httpsServer.close(resolve)));
    }
    Promise.all(shutdowns).then(() => logger.info("Shutdown complete."));
  };
  for (const singal of ["SIGTERM", "SIGINT"] satisfies NodeJS.Signals[]) {
    process.on(singal, terminator);
  }

  return { app, httpServer, httpsServer, logger };
};
