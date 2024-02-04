import express from "express";
import type compression from "compression";
import type fileUpload from "express-fileupload";
import http from "node:http";
import https from "node:https";
import { z } from "zod";
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
import type {
  Server as SocketServer,
  ServerOptions as SocketServerOptions,
} from "socket.io";

const makeCommonEntities = async (config: CommonConfig) => {
  const rootLogger: AbstractLogger = isSimplifiedWinstonConfig(config.logger)
    ? createLogger({ ...config.logger, winston: await loadPeer("winston") })
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

  const { rootLogger, notFoundHandler, parserFailureHandler } =
    await makeCommonEntities(config);
  app.use(parserFailureHandler);
  initRouting({ app, routing, rootLogger, config });
  app.use(notFoundHandler);

  const starter = <T extends http.Server | https.Server>(
    server: T,
    subject: typeof config.server.listen,
  ) =>
    server.listen(subject, () => {
      rootLogger.info("Listening", subject);
    }) as T;

  const httpServer = starter(http.createServer(app), config.server.listen);
  const httpsServer =
    config.https &&
    starter(https.createServer(config.https.options, app), config.https.listen);

  if (config.sockets) {
    rootLogger.warn(
      "Sockets.IO support is an experimental feature. It can be changed or removed at any time regardless of SemVer.",
    );
    const clientEventsSchema = z.object({
      ping: z.function(
        z.tuple([
          z.unknown(),
          z.function(z.tuple([z.literal("pong"), z.unknown()]), z.void()),
        ]),
        z.void(),
      ),
    });
    const io = new (await loadPeer<{
      new (
        opt?: Partial<SocketServerOptions>,
      ): SocketServer<z.input<typeof clientEventsSchema>>;
    }>("socket.io", "Server"))(config.sockets);
    io.attach(httpsServer || httpServer);
    io.on("connection", (socket) => {
      rootLogger.debug("User connected");
      socket.onAny((event, ...payload) => {
        rootLogger.info(event, payload);
      });
      socket.on("ping", (msg, ack) => {
        ack("pong", msg);
      });
      socket.on("disconnect", () => {
        rootLogger.debug("User disconnected");
      });
    });
  }

  return { app, httpServer, httpsServer, logger: rootLogger };
};
