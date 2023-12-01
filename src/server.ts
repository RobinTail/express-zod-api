import express, { ErrorRequestHandler, RequestHandler } from "express";
import compression from "compression";
import fileUpload from "express-fileupload";
import http from "node:http";
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

export const attachRouting = (config: AppConfig, routing: Routing) => {
  const { logger, notFoundHandler } = makeCommonEntities(config);
  initRouting({ app: config.app, routing, logger, config });
  return { notFoundHandler, logger };
};

export const createServer = (config: ServerConfig, routing: Routing) => {
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
  if (config.server.rawParser) {
    app.use(config.server.rawParser);
    app.use((req, {}, next) => {
      if (Buffer.isBuffer(req.body)) {
        req.body = { raw: req.body };
      }
      next();
    });
  }

  const { logger, errorHandler, notFoundHandler } = makeCommonEntities(config);
  app.use(createParserFailureHandler(errorHandler, logger));
  initRouting({ app, routing, logger, config });
  app.use(notFoundHandler);

  const servers = {
    httpServer: http.createServer(app),
    httpsServer: config.https
      ? https.createServer(config.https.options, app)
      : undefined,
  } satisfies Record<string, http.Server | https.Server | undefined>;

  for (const server of Object.values(servers)) {
    const listeningSubject =
      server instanceof https.Server
        ? config.https!.listen
        : config.server.listen;
    server?.listen(listeningSubject, () => {
      logger.info("Listening", listeningSubject);
    });
  }

  return { app, ...servers, logger };
};
