import express from "express";
import type compression from "compression";
import type fileUpload from "express-fileupload";
import http from "node:http";
import https from "node:https";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import {
  AbstractLogger,
  createLogger,
  isSimplifiedWinstonConfig,
} from "./logger";
import { loadPeer } from "./peer-helpers";
import { defaultResultHandler } from "./result-handler";
import { Routing, initRouting } from "./routing";
import {
  createNotFoundHandler,
  createParserFailureHandler,
} from "./server-helpers";

const makeCommonEntities = async (config: CommonConfig) => {
  const logger: AbstractLogger = isSimplifiedWinstonConfig(config.logger)
    ? createLogger({ ...config.logger, winston: await loadPeer("winston") })
    : config.logger;
  const errorHandler = config.errorHandler || defaultResultHandler;
  const { childLoggerProvider } = config;
  const creatorParams = { errorHandler, logger, childLoggerProvider };
  const notFoundHandler = createNotFoundHandler(creatorParams);
  const parserFailureHandler = createParserFailureHandler(creatorParams);
  return { logger, errorHandler, notFoundHandler, parserFailureHandler };
};

export const attachRouting = async (config: AppConfig, routing: Routing) => {
  const { logger, notFoundHandler } = await makeCommonEntities(config);
  initRouting({ app: config.app, routing, logger, config });
  return { notFoundHandler, logger };
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
  if (config.server.upload) {
    const uploader = await loadPeer<typeof fileUpload>("express-fileupload");
    app.use(
      uploader({
        ...(typeof config.server.upload === "object"
          ? config.server.upload
          : {}),
        abortOnLimit: false,
        parseNested: true,
      }),
    );
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

  const { logger, notFoundHandler, parserFailureHandler } =
    await makeCommonEntities(config);
  app.use(parserFailureHandler);
  initRouting({ app, routing, logger, config });
  app.use(notFoundHandler);

  const starter = <T extends http.Server | https.Server>(
    server: T,
    subject: typeof config.server.listen,
  ) =>
    server.listen(subject, () => {
      logger.info("Listening", subject);
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

  return { app, ...servers, logger };
};
