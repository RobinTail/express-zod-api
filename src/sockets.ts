import http from "node:http";
import type {
  Server as SocketServer,
  ServerOptions as SocketServerOptions,
} from "socket.io";
import { z } from "zod";
import { InputValidationError } from "./errors";
import { EventDefinifion } from "./events-factory";
import { AbstractLogger } from "./logger";

export const createSockets = <
  Client extends Record<string, EventDefinifion<z.ZodTuple>>,
>({
  Class,
  options,
  clientEvents,
  logger,
  server,
}: {
  Class: { new (opt?: Partial<SocketServerOptions>): SocketServer };
  options: Partial<SocketServerOptions>;
  clientEvents: Client;
  logger: AbstractLogger;
  server: http.Server;
}) => {
  const io = new Class(options);
  io.on("connection", (socket) => {
    logger.debug("User connected", socket.id);
    socket.onAny((event, ...payload) => {
      logger.info(event, payload);
    });
    for (const [event, def] of Object.entries(clientEvents)) {
      socket.on(event, (...params) => {
        const validation = def.schema.safeParse(params);
        if (validation.success) {
          logger.debug("parsed", validation.data);
          return def.handler(...validation.data);
        }
        throw new InputValidationError(validation.error);
      });
    }
    // @todo this does not work:
    socket.on("error", (err) => {
      logger.error("Event payload validation error", err);
    });
    socket.on("disconnect", () => {
      logger.debug("User disconnected", socket.id);
    });
  });
  io.attach(server);
};
