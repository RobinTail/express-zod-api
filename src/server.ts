import express from "express";
import type compression from "compression";
import http from "node:http";
import https from "node:https";
import { AppConfig, ServerConfig } from "./config-type";
import { loadPeer } from "./peer-helpers";
import { Parsers, Routing, initRouting } from "./routing";
import {
  createUploadParsers,
  moveRaw,
  makeCommonEntities,
  installTerminationListener,
  truthyFb,
} from "./server-helpers";

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
      upload: uploadConfig,
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
    app.use(compressor(truthyFb(compressionConfig, undefined)));
  }

  const parsers: Parsers = {
    json: [jsonParser || express.json()],
    raw: [rawParser || express.raw(), moveRaw],
    upload: uploadConfig
      ? await createUploadParsers({ uploadConfig, getChildLogger })
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
      options: truthyFb(gracefulShutdown, {}),
    });
  }

  return {
    app,
    logger: rootLogger,
    httpServer: starter(httpServer, httpListen),
    httpsServer: httpsServer && starter(httpsServer, httpsConfig?.listen),
  };
};
