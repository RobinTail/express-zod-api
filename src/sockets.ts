import http from "node:http";
import type { Server } from "socket.io";
import { AbstractAction } from "./action";
import { AbstractLogger } from "./logger";

export interface ActionMap {
  [event: string]: AbstractAction;
}

export const attachSockets = ({
  io,
  clientEvents,
  logger,
  target,
}: {
  io: Server;
  clientEvents: ActionMap;
  logger: AbstractLogger;
  target: http.Server;
}): Server => {
  logger.warn(
    "Sockets.IO support is an experimental feature. It can be changed or removed at any time regardless of SemVer.",
  );
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
  return io.attach(target);
};
