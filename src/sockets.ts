import http from "node:http";
import type { Server } from "socket.io";
import { AbstractAction, Handler, SocketFeatures } from "./action";
import { EmissionMap, makeEmitter } from "./emission";
import { AbstractLogger } from "./logger";

export interface ActionMap {
  [event: string]: AbstractAction;
}

export const attachSockets = <E extends EmissionMap>({
  io,
  actions,
  logger,
  target,
  emission,
  onConnection = ({ socketId }) => logger.debug("User connected", socketId),
  onDisconnect = ({ socketId }) => logger.debug("User disconnected", socketId),
  onAnyEvent = ({ input: [event], socketId }) =>
    logger.debug(`${event} from ${socketId}`),
}: {
  io: Server;
  actions: ActionMap;
  logger: AbstractLogger;
  target: http.Server;
  emission: E;
  onConnection?: Handler<[], void, E>;
  onDisconnect?: Handler<[], void, E>;
  onAnyEvent?: Handler<[string], void, E>;
}): Server => {
  logger.warn(
    "Sockets.IO support is an experimental feature. It can be changed or removed at any time regardless of SemVer.",
  );
  io.on("connection", async (socket) => {
    const commons: SocketFeatures = {
      socketId: socket.id,
      isConnected: () => socket.connected,
    };
    const emit = makeEmitter({ emission, socket, logger });
    await onConnection({ input: [], logger, emit, ...commons });
    socket.onAny((event) =>
      onAnyEvent({ input: [event], logger, emit, ...commons }),
    );
    for (const [event, action] of Object.entries(actions)) {
      socket.on(event, async (...params) =>
        action.execute({ event, params, logger, emit, ...commons }),
      );
    }
    socket.on("disconnect", () =>
      onDisconnect({ input: [], logger, emit, ...commons }),
    );
  });
  return io.attach(target);
};
