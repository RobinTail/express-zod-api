import express, { RequestHandler } from "express";
import type compression from "compression";
import type fileUpload from "express-fileupload";
import http from "node:http";
import https from "node:https";
import { AppConfig, CommonConfig, ServerConfig } from "./config-type";
import { ContentType } from "./content-type";
import { AbstractLogger, createLogger, isBuiltinLoggerConfig } from "./logger";
import { loadPeer } from "./peer-helpers";
import { defaultResultHandler } from "./result-handler";
import { Routing, initRouting } from "./routing";
import {
  LocalResponse,
  createLoggingMiddleware,
  createNotFoundHandler,
  createParserFailureHandler,
  createUploadFailueHandler,
  createUploadLogger,
  rawMover,
} from "./server-helpers";
import { getStartupLogo } from "./startup-logo";

const makeCommonEntities = (config: CommonConfig) => {
  if (config.startupLogo !== false) {
    console.log(getStartupLogo());
  }
  const rootLogger: AbstractLogger = isBuiltinLoggerConfig(config.logger)
    ? createLogger(config.logger)
    : config.logger;
  rootLogger.debug("Running", process.env.TSUP_BUILD || "from sources");
  const errorHandler = config.errorHandler || defaultResultHandler;
  const { childLoggerProvider: getChildLogger } = config;
  // @todo should be the request level logger
  const creatorParams = { errorHandler, rootLogger, getChildLogger };
  const notFoundHandler = createNotFoundHandler(creatorParams);
  const parserFailureHandler = createParserFailureHandler(creatorParams);
  return { rootLogger, errorHandler, notFoundHandler, parserFailureHandler };
};

export const attachRouting = (config: AppConfig, routing: Routing) => {
  const { rootLogger, notFoundHandler } = makeCommonEntities(config);
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

  const { rootLogger, notFoundHandler, parserFailureHandler } =
    makeCommonEntities(config);

  app.use(createLoggingMiddleware({ rootLogger, config }));

  const parsers: Record<ContentType, RequestHandler[]> = {
    json: [config.server.jsonParser || express.json()],
    upload: [],
    raw: [],
  };

  if (config.server.upload) {
    const uploader = await loadPeer<typeof fileUpload>("express-fileupload");
    const { limitError, beforeUpload, ...derivedConfig } = {
      ...(typeof config.server.upload === "object" && config.server.upload),
    };
    if (beforeUpload) {
      parsers.upload.push(beforeUpload);
    }
    parsers.upload.push((req, res: LocalResponse, next) =>
      uploader({
        ...derivedConfig,
        abortOnLimit: false,
        parseNested: true,
        logger: createUploadLogger(res.locals.logger || rootLogger),
      })(req, res, next),
    );
    if (limitError) {
      parsers.upload.push(createUploadFailueHandler(limitError));
    }
  }
  if (config.server.rawParser) {
    parsers.raw.push(config.server.rawParser, rawMover);
  }
  if (config.server.beforeRouting) {
    await config.server.beforeRouting({ app, logger: rootLogger });
  }
  initRouting({
    app,
    routing,
    rootLogger,
    config,
    parsers,
  });
  app.use(parserFailureHandler);
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
