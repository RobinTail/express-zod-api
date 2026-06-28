import { setInterval } from "node:timers/promises";
import type { Socket, Server } from "node:net";
import type { ActualLogger } from "./logger-helpers";
import {
  closeAsync,
  hasHttpServer,
  hasResponse,
  isEncrypted,
  weAreClosed,
} from "./graceful-helpers";

export const monitor = ({
  timeout = 1e3,
  logger,
}: { timeout?: number; logger?: ActualLogger } = {}) => {
  let pending: Promise<PromiseSettledResult<void>[]> | undefined;
  const servers: Array<Server> = [];
  const sockets = new Set<Socket>();
  const cleanup = (socket: Socket) => void sockets.delete(socket);
  const destroy = (socket: Socket) => cleanup(socket.destroy());

  const disconnect = (socket: Socket) =>
    void (hasResponse(socket)
      ? !socket._httpMessage.headersSent &&
        socket._httpMessage.setHeader("connection", "close")
      : /* v8 ignore next -- unreachable */ destroy(socket));

  const watch = (socket: Socket) =>
    void (pending
      ? /* v8 ignore next -- unstable */ socket.destroy()
      : sockets.add(
          socket
            .once("close", () => cleanup(socket))
            .once("error", () => destroy(socket)),
        ));

  const add = (...subjects: Server[]) => {
    servers.push(...subjects);
    for (const server of subjects) // eslint-disable-next-line curly
      for (const event of ["connection", "secureConnection"])
        server.on(event, watch);
  };

  const workflow = async () => {
    for (const server of servers) server.on("request", weAreClosed);
    logger?.info("Graceful shutdown", { sockets: sockets.size, timeout });
    for (const socket of sockets)
      if (isEncrypted(socket) || hasHttpServer(socket)) disconnect(socket);
    for await (const started of setInterval(10, Date.now()))
      if (sockets.size === 0 || Date.now() - started >= timeout) break;
    for (const socket of sockets) destroy(socket);
    return Promise.allSettled(servers.map(closeAsync));
  };

  return {
    sockets,
    add,
    shutdown: () => (pending ??= workflow()),
    get isShuttingDown() { return !!pending; }, // eslint-disable-line prettier/prettier
  };
};
