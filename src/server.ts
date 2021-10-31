import express, { ErrorRequestHandler, RequestHandler, json } from "express";
import fileUpload from "express-fileupload";
import { Server } from "http";
import { Logger } from "winston";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { ResultHandlerError } from "./errors";
import { isLoggerConfig } from "./helpers";
import { createLogger } from "./logger";
import { defaultResultHandler, lastResortHandler } from "./result-handler";
import { initRouting, Routing } from "./routing";
import createHttpError from "http-errors";

type AnyResultHandler = NonNullable<CommonConfig["errorHandler"]>;

export const createParserFailureHandler =
  (errorHandler: AnyResultHandler, logger: Logger): ErrorRequestHandler =>
  (error, request, response, next) => {
    if (!error) {
      return next();
    }
    errorHandler.handler({
      error,
      request,
      response,
      logger,
      input: request.body,
      output: null,
    });
  };

export const createNotFoundHandler =
  (errorHandler: AnyResultHandler, logger: Logger): RequestHandler =>
  (request, response) => {
    const error = createHttpError(
      404,
      `Can not ${request.method} ${request.path}`
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
      if (e instanceof Error) {
        lastResortHandler({
          response,
          logger,
          error: new ResultHandlerError(e.message, error),
        });
      }
    }
  };

export function attachRouting(
  config: AppConfig & CommonConfig,
  routing: Routing
) {
  const logger = isLoggerConfig(config.logger)
    ? createLogger(config.logger)
    : config.logger;
  initRouting({ app: config.app, routing, logger, config });
  const errorHandler = config.errorHandler || defaultResultHandler;
  const notFoundHandler = createNotFoundHandler(errorHandler, logger);
  return { notFoundHandler, logger };
}

export function createServer(
  config: ServerConfig & CommonConfig,
  routing: Routing
): Server {
  const logger = isLoggerConfig(config.logger)
    ? createLogger(config.logger)
    : config.logger;
  const app = express();
  const errorHandler = config.errorHandler || defaultResultHandler;
  const jsonParser = config.server.jsonParser || json();
  const multipartParser = config.server.upload
    ? fileUpload({
        ...(typeof config.server.upload === "object"
          ? config.server.upload
          : {}),
        abortOnLimit: false,
        parseNested: true,
      })
    : undefined;

  app.use(([jsonParser] as RequestHandler[]).concat(multipartParser || []));
  app.use(createParserFailureHandler(errorHandler, logger));
  initRouting({ app, routing, logger, config });
  app.use(createNotFoundHandler(errorHandler, logger));

  return app.listen(config.server.listen, () => {
    logger.info(`Listening ${config.server.listen}`);
  });
}
