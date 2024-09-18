import express from "express";
import type compression from "compression";
import http from "node:http";
import https from "node:https";
import { BuiltinLogger } from "./builtin-logger";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { monitor } from "./graceful-shutdown";
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

export const createServer = async (config: ServerConfig, routing: Routing) => {
  const {
    rootLogger,
    getChildLogger,
    notFoundHandler,
    parserFailureHandler,
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
  initRouting({ app, routing, getChildLogger, config, parsers });
  app.use(parserFailureHandler, notFoundHandler);

  const starter = <T extends http.Server | https.Server>(
    server: T,
    subject: typeof config.server.listen,
  ) => server.listen(subject, () => rootLogger.info("Listening", subject)) as T;

  const servers = [http.createServer(app)].concat(
    config.https ? https.createServer(config.https.options, app) : [],
  ) as [http.Server] | [http.Server, https.Server];

  if (config.gracefulShutdown) {
    const graceful = monitor(servers, {
      logger: rootLogger,
      timeout:
        typeof config.gracefulShutdown === "object"
          ? config.gracefulShutdown.timeout
          : undefined,
    });
    const onTerm = () => graceful.shutdown().then(void process.exit);
    for (const trigger of (typeof config.gracefulShutdown === "object"
      ? config.gracefulShutdown.events
      : undefined) || ["SIGINT", "SIGTERM"])
      process.on(trigger, onTerm);
  }

  const [httpServer, httpsServer] = servers;

  return {
    app,
    logger: rootLogger,
    httpServer: starter(httpServer, config.server.listen),
    httpsServer: httpsServer && starter(httpsServer, config.https!.listen), // ensured by presence
  };
};
