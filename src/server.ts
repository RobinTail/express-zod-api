import express from "express";
import type compression from "compression";
import type fileUpload from "express-fileupload";
import http from "node:http";
import https from "node:https";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { AbstractLogger, createLogger, isLoggerConfig } from "./logger";
import { loadPeer } from "./peer-helpers";
import { defaultResultHandler } from "./result-handler";
import { Routing, initRouting } from "./routing";
import {
  createNotFoundHandler,
  createParserFailureHandler,
  createUploadFailueHandler,
} from "./server-helpers";

const makeCommonEntities = async (config: CommonConfig) => {
  const rootLogger: AbstractLogger = isLoggerConfig(config.logger)
    ? createLogger({ ...config.logger })
    : config.logger;
  const errorHandler = config.errorHandler || defaultResultHandler;
  const { childLoggerProvider: getChildLogger } = config;
  const creatorParams = { errorHandler, rootLogger, getChildLogger };
  const notFoundHandler = createNotFoundHandler(creatorParams);
  const parserFailureHandler = createParserFailureHandler(creatorParams);
  return { rootLogger, errorHandler, notFoundHandler, parserFailureHandler };
};

export const attachRouting = async (config: AppConfig, routing: Routing) => {
  const { rootLogger, notFoundHandler } = await makeCommonEntities(config);
  initRouting({ app: config.app, routing, rootLogger, config });
  return { notFoundHandler, logger: rootLogger };
};

export const createServer = async (config: ServerConfig, routing: Routing) => {
  const app = express().disable("x-powered-by");
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
  app.use(config.server.jsonParser || express.json());

  const { rootLogger, notFoundHandler, parserFailureHandler } =
    await makeCommonEntities(config);

  if (config.server.upload) {
    const uploader = await loadPeer<typeof fileUpload>("express-fileupload");
    const { limitError, beforeUpload, ...derivedConfig } = {
      ...(typeof config.server.upload === "object" && config.server.upload),
    };
    if (beforeUpload) {
      beforeUpload({ app, logger: rootLogger });
    }
    app.use(
      uploader({
        ...derivedConfig,
        abortOnLimit: false,
        parseNested: true,
        logger: { log: rootLogger.debug.bind(rootLogger) },
      }),
    );
    if (limitError) {
      app.use(createUploadFailueHandler(limitError));
    }
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
  app.use(parserFailureHandler);
  if (config.server.beforeRouting) {
    await config.server.beforeRouting({ app, logger: rootLogger });
  }
  initRouting({ app, routing, rootLogger, config });
  app.use(notFoundHandler);

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
