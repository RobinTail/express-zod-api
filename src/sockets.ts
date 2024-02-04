import http from "node:http";
import type {
  Server as SocketServer,
  ServerOptions as SocketServerOptions,
} from "socket.io";
import { z } from "zod";
import { InputValidationError, RoutingError } from "./errors";
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
    logger.debug("User connected");
    socket.onAny((event, ...payload) => {
      logger.info(event, payload);
    });
    socket.use(([event, ...params], next) => {
      const schema =
        event in clientEvents ? clientEvents[event].schema : undefined;
      if (!schema) {
        return next(new RoutingError("Unknown event"));
      }
      const validation = schema.safeParse(params);
      next(
        validation.success
          ? undefined
          : new InputValidationError(validation.error),
      ); // @todo transformations?
    });
    for (const [event, def] of Object.entries(clientEvents)) {
      socket.on(event, def.handler);
    }
    socket.on("error", (err) => {
      logger.error("Event payload validation error", err);
    });
    socket.on("disconnect", () => {
      logger.debug("User disconnected");
    });
  });
  io.attach(server);
};
