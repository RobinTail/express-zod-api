import http from "node:http";
import https from "node:https";
import type { Duplex } from "node:stream";
import type { ActualLogger } from "./logger-helpers";
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

export const graceful = ({
  server,
  timeout = 1e3,
  logger,
}: {
  server: http.Server | https.Server;
  timeout?: number;
  logger?: ActualLogger;
}) => {
  const sockets = new Set<Duplex>();

  let terminating: Promise<void> | undefined;

  const onConnection = (socket: Duplex) => {
    if (terminating) {
      socket.destroy();
    } else {
      sockets.add(socket);
      socket.once("close", () => {
        sockets.delete(socket);
      });
    }
  };

  server.on("connection", onConnection);
  server.on("secureConnection", onConnection);

  /**
   * Evaluate whether additional steps are required to destroy the socket.
   * @see https://github.com/nodejs/node/blob/57bd715d527aba8dae56b975056961b0e429e91e/lib/_http_client.js#L363-L413
   */
  const destroySocket = (socket: Duplex) =>
    void sockets.delete(socket.destroy());

  const shutdown = () => {
    if (terminating) {
      logger?.warn("Already terminating...");
      return terminating;
    }

    return (terminating = Promise.resolve()
      .then(async () => {
        server.on("request", ({}, outgoingMessage) => {
          if (!outgoingMessage.headersSent)
            outgoingMessage.setHeader("connection", "close");
        });
        for (const socket of sockets) {
          if (!hasHttpServer(socket)) continue; // This is the HTTP CONNECT request socket.
          if (hasResponse(socket)) {
            if (!socket._httpMessage.headersSent)
              socket._httpMessage.setHeader("connection", "close");
            continue;
          }
          destroySocket(socket);
        }
        // Wait for all in-flight connections to drain, forcefully terminating any
        // open connections after the given timeout
        for await (const started of setInterval(10, Date.now())) {
          if (sockets.size === 0 || Date.now() - started >= timeout) {
            break;
          }
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
  };

  return { sockets, shutdown };
};
