import http from "node:http";
import https from "node:https";
import { setInterval } from "node:timers/promises";
import type { Socket } from "node:net";
import type { TLSSocket } from "node:tls";
import type { ActualLogger } from "./logger-helpers";

const hasResponse = (
  socket: Socket,
): socket is typeof socket & { _httpMessage: http.ServerResponse } =>
  "_httpMessage" in socket &&
  socket._httpMessage instanceof http.ServerResponse;

const hasHttpServer = (
  socket: Socket,
): socket is typeof socket & { server: http.Server } =>
  "server" in socket && socket.server instanceof http.Server;

const isEncrypted = (socket: Socket): socket is TLSSocket =>
  "encrypted" in socket &&
  typeof socket.encrypted === "boolean" &&
  socket.encrypted;

const weAreClosed: http.RequestListener = ({}, res) =>
  void (!res.headersSent && res.setHeader("connection", "close"));

export const monitor = ({
  server,
  timeout = 1e3,
  logger,
}: {
  server: http.Server | https.Server;
  timeout?: number;
  logger?: ActualLogger;
}) => {
  const sockets = new Set<Socket>();

  let pending: Promise<void> | undefined;

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

  const destroy = (socket: Socket) => void sockets.delete(socket.destroy());

  const disconnect = (socket: Socket) =>
    void (hasResponse(socket)
      ? !socket._httpMessage.headersSent &&
        socket._httpMessage.setHeader("connection", "close")
      : destroy(socket));

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
