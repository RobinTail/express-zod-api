import type {
  Server as SocketServer,
  ServerOptions as SocketServerOptions,
} from "socket.io";
import { z } from "zod";
import { Case } from "./case";
import { AbstractLogger } from "./logger";

export const createSockets = <
  Client extends Record<string, Case<z.ZodTuple, z.ZodTuple | undefined>>,
>({
  Class,
  options,
  clientEvents,
  logger,
}: {
  Class: { new (opt?: Partial<SocketServerOptions>): SocketServer };
  options: Partial<SocketServerOptions>;
  clientEvents: Client;
  logger: AbstractLogger;
}): SocketServer => {
  const io = new Class(options);
  io.on("connection", (socket) => {
    logger.debug("User connected", socket.id);
    socket.onAny((event, ...payload) => {
      logger.info(event, payload);
    });
    for (const [event, handler] of Object.entries(clientEvents)) {
      socket.on(event, async (...params) =>
        handler.execute({ event, params, logger }),
      );
    }
    socket.on("disconnect", () => {
      logger.debug("User disconnected", socket.id);
    });
  });
  return io;
};
