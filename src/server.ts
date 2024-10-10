import express from "express";
import type compression from "compression";
import http from "node:http";
import https from "node:https";
import { ListenOptions } from "node:net";
import { reject, isNil } from "ramda";
import { BuiltinLogger } from "./builtin-logger";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { isLoggerInstance } from "./logger-helpers";
import { loadPeer } from "./peer-helpers";
import { defaultResultHandler } from "./result-handler";
import { Parsers, Routing, initRouting } from "./routing";
import {
  createLoggingMiddleware,
  createNotFoundHandler,
  createParserFailureHandler,
  createUploadParsers,
  makeChildLoggerExtractor,
  installDeprecationListener,
  moveRaw,
  installTerminationListener,
} from "./server-helpers";
import { getStartupLogo } from "./startup-logo";

const makeCommonEntities = (config: CommonConfig) => {
  if (config.startupLogo !== false) console.log(getStartupLogo());
  const errorHandler = config.errorHandler || defaultResultHandler;
  const rootLogger = isLoggerInstance(config.logger)
    ? config.logger
    : new BuiltinLogger(config.logger);
  rootLogger.debug("Running", process.env.TSUP_BUILD || "from sources");
  installDeprecationListener(rootLogger);
  const loggingMiddleware = createLoggingMiddleware({ rootLogger, config });
  const getChildLogger = makeChildLoggerExtractor(rootLogger);
  const commons = { getChildLogger, errorHandler };
  const notFoundHandler = createNotFoundHandler(commons);
  const parserFailureHandler = createParserFailureHandler(commons);
  return {
    ...commons,
    rootLogger,
    notFoundHandler,
    parserFailureHandler,
    loggingMiddleware,
  };
};

export const attachRouting = (config: AppConfig, routing: Routing) => {
  const { rootLogger, getChildLogger, notFoundHandler, loggingMiddleware } =
    makeCommonEntities(config);
  initRouting({
    app: config.app.use(loggingMiddleware),
    routing,
    getChildLogger,
    config,
  });
  return { notFoundHandler, logger: rootLogger };
};

export const createServer = async <
  HTTP extends ServerConfig["http"],
  HTTPS extends ServerConfig["https"],
>(
  config: ServerConfig<HTTP, HTTPS>,
  routing: Routing,
) => {
  const {
    rootLogger,
    getChildLogger,
    notFoundHandler,
    parserFailureHandler,
    loggingMiddleware,
  } = makeCommonEntities(config);
  const app = express().disable("x-powered-by").use(loggingMiddleware);

  if (config.compression) {
    const compressor = await loadPeer<typeof compression>("compression");
    app.use(
      compressor(
        typeof config.compression === "object" ? config.compression : undefined,
      ),
    );
  }

  const parsers: Parsers = {
    json: [config.jsonParser || express.json()],
    raw: [config.rawParser || express.raw(), moveRaw],
    upload: config.upload
      ? await createUploadParsers({ config, getChildLogger })
      : [],
  };

  if (config.beforeRouting) {
    await config.beforeRouting({
      app,
      logger: rootLogger,
      getChildLogger,
    });
  }
  initRouting({ app, routing, getChildLogger, config, parsers });
  app.use(parserFailureHandler, notFoundHandler);

  const starter = <T extends http.Server | https.Server>(
    server: T,
    subject?: number | string | ListenOptions,
  ) => server.listen(subject, () => rootLogger.info("Listening", subject)) as T;

  const httpServer = config.http && http.createServer(app);
  const httpsServer =
    config.https && https.createServer(config.https.options, app);

  if (config.gracefulShutdown) {
    installTerminationListener({
      servers: reject(isNil, [httpServer, httpsServer]),
      logger: rootLogger,
      options: config.gracefulShutdown === true ? {} : config.gracefulShutdown,
    });
  }

  return {
    app,
    logger: rootLogger,
    httpServer: (httpServer &&
      starter(httpServer, config.http?.listen)) as HTTP extends undefined
      ? undefined
      : http.Server,
    httpsServer: (httpsServer &&
      starter(httpsServer, config.https?.listen)) as HTTPS extends undefined
      ? undefined
      : https.Server,
  };
};
