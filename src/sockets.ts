import http from "node:http";
import type {
  Server as SocketServer,
  ServerOptions as SocketServerOptions,
} from "socket.io";
import { AbstractAction } from "./action";
import { AbstractLogger } from "./logger";

export interface ActionMap {
  [event: string]: AbstractAction;
}

export const createSockets = ({
  Class,
  options,
  clientEvents,
  logger,
  server,
}: {
  Class: { new (opt?: Partial<SocketServerOptions>): SocketServer };
  options?: Partial<SocketServerOptions>;
  clientEvents: ActionMap;
  logger: AbstractLogger;
  server: http.Server;
}): SocketServer => {
  logger.warn(
    "Sockets.IO support is an experimental feature. It can be changed or removed at any time regardless of SemVer.",
  );
  const io = new Class(options);
  io.on("connection", (socket) => {
    logger.debug("User connected", socket.id);
    socket.onAny((event) => {
      logger.info(`${event} from ${socket.id}`);
    });
    for (const [event, action] of Object.entries(clientEvents)) {
      socket.on(event, async (...params) =>
        action.execute({ event, params, logger }),
      );
    }
    socket.on("disconnect", () => {
      logger.debug("User disconnected", socket.id);
    });
  });
  return io.attach(server);
};
