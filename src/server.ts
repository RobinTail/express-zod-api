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
  rootLogger.debug("Running", {
    build: process.env.TSUP_BUILD || "from sources",
    env: process.env.NODE_ENV || "development",
  });
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
  initRouting({ app, routing, rootLogger, getChildLogger, config, parsers });
  app.use(parserFailureHandler, notFoundHandler);

  const makeStarter =
    (server: http.Server | https.Server, subject: HttpConfig["listen"]) => () =>
      server.listen(subject, () => rootLogger.info("Listening", subject));

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
      servers: created,
      logger: rootLogger,
      options: config.gracefulShutdown === true ? {} : config.gracefulShutdown,
    });
  }

  return {
    app,
    logger: rootLogger,
    servers: starters.map((starter) => starter()),
  };
};
