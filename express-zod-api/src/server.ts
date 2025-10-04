import express from "express";
import type compression from "compression";
import http from "node:http";
import https from "node:https";
import { BuiltinLogger } from "./builtin-logger.ts";
import type {
  AppConfig,
  CommonConfig,
  HttpConfig,
  ServerConfig,
} from "./config-type.ts";
import { isLoggerInstance } from "./logger-helpers.ts";
import { loadPeer } from "./peer-helpers.ts";
import { defaultResultHandler } from "./result-handler.ts";
import { type Parsers, type Routing, initRouting } from "./routing.ts";
import {
  createLoggingMiddleware,
  createNotFoundHandler,
  createCatcher,
  createUploadParsers,
  makeGetLogger,
  installDeprecationListener,
  moveRaw,
  installTerminationListener,
} from "./server-helpers.ts";
import { printStartupLogo } from "./startup-logo.ts";

const makeCommonEntities = (config: CommonConfig) => {
  if (config.startupLogo !== false) printStartupLogo(process.stdout);
  const errorHandler = config.errorHandler || defaultResultHandler;
  const logger = isLoggerInstance(config.logger)
    ? config.logger
    : new BuiltinLogger(config.logger);
  logger.debug("Running", {
    build: process.env.TSDOWN_BUILD || "from sources", // eslint-disable-line no-restricted-syntax -- substituted by TSDOWN
    env: process.env.NODE_ENV || "development", // eslint-disable-line no-restricted-syntax -- intentionally for debug
  });
  installDeprecationListener(logger);
  const loggingMiddleware = createLoggingMiddleware({ logger, config });
  const getLogger = makeGetLogger(logger);
  const commons = { getLogger, errorHandler };
  const notFoundHandler = createNotFoundHandler(commons);
  const catcher = createCatcher(commons);
  return {
    ...commons,
    logger,
    notFoundHandler,
    catcher,
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
  const { logger, getLogger, notFoundHandler, catcher, loggingMiddleware } =
    makeCommonEntities(config);
  const app = express()
    .disable("x-powered-by")
    .set("query parser", config.queryParser ?? "simple")
    .use(loggingMiddleware);

  if (config.compression) {
    const compressor = await loadPeer<typeof compression>("compression");
    app.use(
      compressor(
        typeof config.compression === "object" ? config.compression : undefined,
      ),
    );
  }
  await config.beforeRouting?.({ app, getLogger });

  const parsers: Parsers = {
    json: [config.jsonParser || express.json()],
    raw: [config.rawParser || express.raw(), moveRaw],
    form: [config.formParser || express.urlencoded()],
    upload: config.upload
      ? await createUploadParsers({ config, getLogger })
      : [],
  };
  initRouting({ app, routing, getLogger, config, parsers });
  app.use(catcher, notFoundHandler);

  const created: Array<http.Server | https.Server> = [];
  const makeStarter =
    (server: (typeof created)[number], subject: HttpConfig["listen"]) => () =>
      server.listen(subject, () => logger.info("Listening", subject));

  const starters: Array<ReturnType<typeof makeStarter>> = [];
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
  if (!created.length) logger.warn("No servers configured.");

  if (config.gracefulShutdown) {
    installTerminationListener({
      logger,
      servers: created,
      options: config.gracefulShutdown === true ? {} : config.gracefulShutdown,
    });
  }

  return { app, logger, servers: starters.map((starter) => starter()) };
};
