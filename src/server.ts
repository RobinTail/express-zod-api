import express from "express";
import type compression from "compression";
import http from "node:http";
import https from "node:https";
import { BuiltinLogger } from "./builtin-logger";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { isLoggerInstance } from "./logger-helpers";
import { loadPeer } from "./peer-helpers";
import { defaultResultHandler } from "./result-handler";
import { Parsers, Routing, initRouting } from "./routing";
import {
  createLoggingMiddleware,
  createNotFoundHandler,
  createCatcher,
  createUploadParsers,
  makeChildLoggerExtractor,
  installDeprecationListener,
  moveRaw,
  installTerminationListener,
} from "./server-helpers";
import { printStartupLogo } from "./startup-logo";

const makeCommonEntities = (config: CommonConfig) => {
  if (config.startupLogo !== false) printStartupLogo(process.stdout);
  const errorHandler = config.errorHandler || defaultResultHandler;
  const rootLogger = isLoggerInstance(config.logger)
    ? config.logger
    : new BuiltinLogger(config.logger);
  rootLogger.debug("Running", {
    build: process.env.TSUP_BUILD || "from sources",
    env: process.env.NODE_ENV || "development",
  });
  installDeprecationListener(rootLogger);
  const loggingMiddleware = createLoggingMiddleware({ rootLogger, config });
  const getChildLogger = makeChildLoggerExtractor(rootLogger);
  const commons = { getChildLogger, errorHandler };
  const notFoundHandler = createNotFoundHandler(commons);
  const catcher = createCatcher(commons);
  return {
    ...commons,
    rootLogger,
    notFoundHandler,
    catcher,
    loggingMiddleware,
  };
};

export const attachRouting = (config: AppConfig, routing: Routing) => {
  const { rootLogger, getChildLogger, notFoundHandler, loggingMiddleware } =
    makeCommonEntities(config);
  initRouting({
    app: config.app.use(loggingMiddleware),
    rootLogger,
    routing,
    getChildLogger,
    config,
  });
  return { notFoundHandler, logger: rootLogger };
};

export const createServer = async (config: ServerConfig, routing: Routing) => {
  const {
    rootLogger,
    getChildLogger,
    notFoundHandler,
    catcher,
    loggingMiddleware,
  } = makeCommonEntities(config);
  const app = express().disable("x-powered-by").use(loggingMiddleware);

  if (config.server.compression) {
    const compressor = await loadPeer<typeof compression>("compression");
    app.use(
      compressor(
        typeof config.server.compression === "object"
          ? config.server.compression
          : undefined,
      ),
    );
  }

  const parsers: Parsers = {
    json: [config.server.jsonParser || express.json()],
    raw: [config.server.rawParser || express.raw(), moveRaw],
    upload: config.server.upload
      ? await createUploadParsers({ config, getChildLogger })
      : [],
  };

  if (config.server.beforeRouting) {
    await config.server.beforeRouting({
      app,
      logger: rootLogger,
      getChildLogger,
    });
  }
  initRouting({ app, routing, rootLogger, getChildLogger, config, parsers });
  app.use(catcher, notFoundHandler);

  const starter = <T extends http.Server | https.Server>(
    server: T,
    subject?: typeof config.server.listen,
  ) => server.listen(subject, () => rootLogger.info("Listening", subject)) as T;

  const httpServer = http.createServer(app);
  const httpsServer =
    config.https && https.createServer(config.https.options, app);

  if (config.gracefulShutdown) {
    installTerminationListener({
      servers: [httpServer].concat(httpsServer || []),
      logger: rootLogger,
      options: config.gracefulShutdown === true ? {} : config.gracefulShutdown,
    });
  }

  return {
    app,
    logger: rootLogger,
    httpServer: starter(httpServer, config.server.listen),
    httpsServer: httpsServer && starter(httpsServer, config.https?.listen),
  };
};
