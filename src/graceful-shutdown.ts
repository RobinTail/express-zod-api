import http from "node:http";
import https from "node:https";
import type { Duplex } from "node:stream";
import { setInterval } from "node:timers/promises";

const hasResponse = (
  socket: Duplex,
): socket is typeof socket & { _httpMessage: http.ServerResponse } =>
  "_httpMessage" in socket &&
  socket._httpMessage instanceof http.ServerResponse;

const hasHttpServer = (
  socket: Duplex,
): socket is typeof socket & { server: http.Server } =>
  "server" in socket && socket.server instanceof http.Server;

const onRequest: http.RequestListener = ({}, res) =>
  void (!res.headersSent && res.setHeader("connection", "close"));

export const graceful = ({
  server,
  timeout = 1e3,
}: {
  server: http.Server | https.Server;
  timeout?: number;
}) => {
  const sockets = new Set<Duplex>();

  let terminating: Promise<void> | undefined;

  const onConnection = (socket: Duplex) =>
    void (terminating
      ? socket.destroy()
      : sockets.add(socket.once("close", () => void sockets.delete(socket))));

  server.on("connection", onConnection);
  server.on("secureConnection", onConnection);

  const destroySocket = (socket: Duplex) =>
    void sockets.delete(socket.destroy());

  const shutdown = () =>
    (terminating ??= Promise.resolve()
      .then(async () => {
        server.on("request", onRequest);
        for (const socket of sockets) {
          if (hasHttpServer(socket)) {
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
      })
      .then(
        () =>
          new Promise(
            (resolve, reject) =>
              void server.close((error) => (error ? reject(error) : resolve())),
          ),
      ));

  return { sockets, shutdown };
};
