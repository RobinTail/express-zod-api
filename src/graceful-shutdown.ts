import http from "node:http";
import https from "node:https";
import type { Socket } from "node:net";
import type { TLSSocket } from "node:tls";
import { setInterval } from "node:timers/promises";

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

const onRequest: http.RequestListener = ({}, res) =>
  void (!res.headersSent && res.setHeader("connection", "close"));

export const graceful = ({
  server,
  timeout = 1e3,
}: {
  server: http.Server | https.Server;
  timeout?: number;
}) => {
  const sockets = new Set<Socket>();

  let terminating: Promise<void> | undefined;

  const onConnection = (socket: Socket) =>
    void (terminating
      ? socket.destroy()
      : sockets.add(socket.once("close", () => void sockets.delete(socket))));

  server.on("connection", onConnection);
  server.on("secureConnection", onConnection);

  const closeAsync = () =>
    new Promise<void>(
      (resolve, reject) =>
        void server.close((error) => (error ? reject(error) : resolve())),
    );

  const destroySocket = (socket: Socket) =>
    void sockets.delete(socket.destroy());

  const workflow = async () => {
    server.on("request", onRequest);
    for (const socket of sockets) {
      if (isEncrypted(socket) || hasHttpServer(socket)) {
        if (hasResponse(socket)) {
          if (!socket._httpMessage.headersSent)
            socket._httpMessage.setHeader("connection", "close");
          continue;
        }
        destroySocket(socket);
      }
    }
    for await (const started of setInterval(10, Date.now())) {
      if (sockets.size === 0 || Date.now() - started >= timeout) break;
    }
    for (const socket of sockets) destroySocket(socket);
    return closeAsync();
  };

  const shutdown = () => (terminating ??= workflow());

  return { sockets, shutdown };
};
