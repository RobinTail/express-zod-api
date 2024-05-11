import express from "express";
import type compression from "compression";
import http from "node:http";
import https from "node:https";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { createLogger, isBuiltinLoggerConfig } from "./logger";
import { loadPeer } from "./peer-helpers";
import { defaultResultHandler } from "./result-handler";
import { Parsers, Routing, initRouting } from "./routing";
import {
  createLoggingMiddleware,
  createNotFoundHandler,
  createParserFailureHandler,
  createUploadParsers,
  moveRaw,
} from "./server-helpers";
import { getStartupLogo } from "./startup-logo";

const makeCommonEntities = (config: CommonConfig) => {
  if (config.startupLogo !== false) {
    console.log(getStartupLogo());
  }
  const errorHandler = config.errorHandler || defaultResultHandler;
  const rootLogger = isBuiltinLoggerConfig(config.logger)
    ? createLogger(config.logger)
    : config.logger;
  rootLogger.debug("Running", process.env.TSUP_BUILD || "from sources");
  const loggingMiddleware = createLoggingMiddleware({ rootLogger, config });
  const notFoundHandler = createNotFoundHandler({ rootLogger, errorHandler });
  const parserFailureHandler = createParserFailureHandler({
    rootLogger,
    errorHandler,
  });
  return {
    rootLogger,
    errorHandler,
    notFoundHandler,
    parserFailureHandler,
    loggingMiddleware,
  };
};

export const attachRouting = (config: AppConfig, routing: Routing) => {
  const { rootLogger, notFoundHandler, loggingMiddleware } =
    makeCommonEntities(config);
  initRouting({
    app: config.app.use(loggingMiddleware),
    routing,
    rootLogger,
    config,
  });
  return { notFoundHandler, logger: rootLogger };
};

export const createServer = async (config: ServerConfig, routing: Routing) => {
  const {
    rootLogger,
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
      ? await createUploadParsers({ config, rootLogger })
      : [],
  };

  if (config.server.beforeRouting) {
    await config.server.beforeRouting({ app, logger: rootLogger });
  }
  initRouting({ app, routing, rootLogger, config, parsers });
  app.use(parserFailureHandler, notFoundHandler);

  const starter = <T extends http.Server | https.Server>(
    server: T,
    subject: typeof config.server.listen,
  ) =>
    server.listen(subject, () => {
      rootLogger.info("Listening", subject);
    }) as T;

  const servers = {
    httpServer: starter(http.createServer(app), config.server.listen),
    httpsServer: config.https
      ? starter(
          https.createServer(config.https.options, app),
          config.https.listen,
        )
      : undefined,
  } satisfies Record<string, http.Server | https.Server | undefined>;

  return { app, ...servers, logger: rootLogger };
};
