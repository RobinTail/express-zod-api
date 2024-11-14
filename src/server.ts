import express from "express";
import type compression from "compression";
import http from "node:http";
import https from "node:https";
import { BuiltinLogger } from "./builtin-logger";
import {
  AppConfig,
  CommonConfig,
  HttpConfig,
  ServerConfig,
} from "./config-type";
import { isLoggerInstance } from "./logger-helpers";
import { loadPeer } from "./peer-helpers";
import { defaultResultHandler } from "./result-handler";
import { Parsers, Routing, initRouting } from "./routing";
import {
  createLoggingMiddleware,
  createNotFoundHandler,
  createParserFailureHandler,
  createUploadParsers,
  makeGetLogger,
  installDeprecationListener,
  moveRaw,
  installTerminationListener,
} from "./server-helpers";
import { getStartupLogo } from "./startup-logo";

const makeCommonEntities = (config: CommonConfig) => {
  if (config.startupLogo !== false) console.log(getStartupLogo());
  const errorHandler = config.errorHandler || defaultResultHandler;
  const logger = isLoggerInstance(config.logger)
    ? config.logger
    : new BuiltinLogger(config.logger);
  logger.debug("Running", {
    build: process.env.TSUP_BUILD || "from sources",
    env: process.env.NODE_ENV || "development",
  });
  installDeprecationListener(logger);
  const loggingMiddleware = createLoggingMiddleware({ logger, config });
  const getLogger = makeGetLogger(logger);
  const commons = { getLogger, errorHandler };
  const notFoundHandler = createNotFoundHandler(commons);
  const parserFailureHandler = createParserFailureHandler(commons);
  return {
    ...commons,
    logger,
    notFoundHandler,
    parserFailureHandler,
    loggingMiddleware,
  };
};

export const attachRouting = (config: AppConfig, routing: Routing) => {
  const { logger, getLogger, notFoundHandler, loggingMiddleware } =
    makeCommonEntities(config);
  initRouting({
    app: config.app.use(loggingMiddleware),
    routing,
    getLogger,
    config,
  });
  return { notFoundHandler, logger };
};

export const createServer = async (config: ServerConfig, routing: Routing) => {
  const {
    logger,
    getLogger,
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
      ? await createUploadParsers({ config, getLogger })
      : [],
  };

  await config.beforeRouting?.({ app, getLogger });
  initRouting({ app, routing, getLogger, config, parsers });
  app.use(parserFailureHandler, notFoundHandler);

  const makeStarter =
    (server: http.Server | https.Server, subject: HttpConfig["listen"]) => () =>
      server.listen(subject, () => logger.info("Listening", subject));

  const created: Array<http.Server | https.Server> = [];
  const starters: Array<() => http.Server | https.Server> = [];
  if (config.http) {
    const httpServer = http.createServer(app);
    created.push(httpServer);
    starters.push(makeStarter(httpServer, config.http.listen));
  }
  if (config.https) {
    const httpsServer = https.createServer(config.https.options, app);
    created.push(httpsServer);
    starters.push(makeStarter(httpsServer, config.https.listen));
  }

  if (config.gracefulShutdown) {
    installTerminationListener({
      logger,
      servers: created,
      options: config.gracefulShutdown === true ? {} : config.gracefulShutdown,
    });
  }

  return { app, logger, servers: starters.map((starter) => starter()) };
};
