import http from "node:http";
import https from "node:https";
import { setInterval } from "node:timers/promises";
import type { Socket } from "node:net";
import type { ActualLogger } from "./logger-helpers";
import {
  hasHttpServer,
  hasResponse,
  isEncrypted,
  weAreClosed,
} from "./graceful-helpers";

export const monitor = ({
  server,
  timeout = 1e3,
  logger,
}: {
  server: http.Server | https.Server;
  timeout?: number;
  logger?: ActualLogger;
}) => {
  let pending: Promise<void> | undefined;
  const sockets = new Set<Socket>();
  const destroy = (socket: Socket) => void sockets.delete(socket.destroy());

  const disconnect = (socket: Socket) =>
    void (hasResponse(socket)
      ? !socket._httpMessage.headersSent &&
        socket._httpMessage.setHeader("connection", "close")
      : destroy(socket));

  const watch = (socket: Socket) =>
    void (pending
      ? socket.destroy()
      : sockets.add(socket.once("close", () => void sockets.delete(socket))));

  server.on("connection", watch);
  server.on("secureConnection", watch);

  const closeAsync = () =>
    new Promise<void>(
      (resolve, reject) =>
        void server.close((error) => (error ? reject(error) : resolve())),
    );

  const workflow = async () => {
    server.on("request", weAreClosed);
    logger?.info("Graceful shutdown", { sockets: sockets.size, timeout });
    for (const socket of sockets) {
      if (isEncrypted(socket) || hasHttpServer(socket)) disconnect(socket);
    }
    for await (const started of setInterval(10, Date.now())) {
      if (sockets.size === 0 || Date.now() - started >= timeout) break;
    }
    for (const socket of sockets) destroy(socket);
    return closeAsync();
  };

  return { sockets, shutdown: () => (pending ??= workflow()) };
};
