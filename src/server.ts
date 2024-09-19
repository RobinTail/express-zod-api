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
  createParserFailureHandler,
  createUploadParsers,
  makeChildLoggerExtractor,
  installDeprecationListener,
  moveRaw,
  installTerminationListener,
} from "./server-helpers";
import { getStartupLogo } from "./startup-logo";

const makeCommonEntities = ({
  startupLogo = true,
  errorHandler: chosenErrorHandler,
  logger: loggerConfig,
  childLoggerProvider: provider,
}: Pick<
  CommonConfig,
  "startupLogo" | "errorHandler" | "logger" | "childLoggerProvider"
>) => {
  if (startupLogo) console.log(getStartupLogo());
  const errorHandler = chosenErrorHandler || defaultResultHandler;
  const rootLogger = isLoggerInstance(loggerConfig)
    ? loggerConfig
    : new BuiltinLogger(loggerConfig);
  rootLogger.debug("Running", process.env.TSUP_BUILD || "from sources");
  installDeprecationListener(rootLogger);
  const loggingMiddleware = createLoggingMiddleware({ rootLogger, provider });
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

export const attachRouting = (
  { app, ...rest }: AppConfig,
  routing: Routing,
) => {
  const { rootLogger, getChildLogger, notFoundHandler, loggingMiddleware } =
    makeCommonEntities(rest);
  initRouting({
    app: app.use(loggingMiddleware),
    routing,
    getChildLogger,
    config: rest,
  });
  return { notFoundHandler, logger: rootLogger };
};

export const createServer = async (
  {
    server: {
      compression: compressionConfig,
      jsonParser,
      rawParser,
      upload,
      beforeRouting,
      listen: httpListen,
    },
    https: httpsConfig,
    gracefulShutdown,
    ...rest
  }: ServerConfig,
  routing: Routing,
) => {
  const {
    rootLogger,
    getChildLogger,
    notFoundHandler,
    parserFailureHandler,
    loggingMiddleware,
  } = makeCommonEntities(rest);
  const app = express().disable("x-powered-by").use(loggingMiddleware);

  if (compressionConfig) {
    const compressor = await loadPeer<typeof compression>("compression");
    app.use(
      compressor({
        ...(typeof compressionConfig === "object" && compressionConfig),
      }),
    );
  }

  const parsers: Parsers = {
    json: [jsonParser || express.json()],
    raw: [rawParser || express.raw(), moveRaw],
    upload: upload
      ? await createUploadParsers({ config: upload, getChildLogger })
      : [],
  };

  if (beforeRouting) {
    await beforeRouting({ app, logger: rootLogger, getChildLogger });
  }
  initRouting({ app, routing, getChildLogger, config: rest, parsers });
  app.use(parserFailureHandler, notFoundHandler);

  const starter = <T extends http.Server | https.Server>(
    server: T,
    subject?: typeof httpListen,
  ) => server.listen(subject, () => rootLogger.info("Listening", subject)) as T;

  const httpServer = http.createServer(app);
  const httpsServer =
    httpsConfig && https.createServer(httpsConfig.options, app);

  if (gracefulShutdown) {
    installTerminationListener({
      servers: [httpServer].concat(httpsServer || []),
      logger: rootLogger,
      options: {
        ...(typeof gracefulShutdown === "object" && gracefulShutdown),
      },
    });
  }

  return {
    app,
    logger: rootLogger,
    httpServer: starter(httpServer, httpListen),
    httpsServer: httpsServer && starter(httpsServer, httpsConfig?.listen),
  };
};
