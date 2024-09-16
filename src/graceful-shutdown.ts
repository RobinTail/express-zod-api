import http, { ServerResponse } from "node:http";
import type { Server } from "node:net";
import type { Duplex } from "node:stream";
import type { ActualLogger } from "./logger-helpers";

const hasResponse = (
  socket: Duplex,
): socket is typeof socket & { _httpMessage: ServerResponse } =>
  "_httpMessage" in socket && socket._httpMessage instanceof ServerResponse;

const hasHttpServer = (
  socket: Duplex,
): socket is typeof socket & { server: http.Server } =>
  "server" in socket && socket.server instanceof http.Server;

export const graceful = ({
  server,
  gracefulTerminationTimeout = 1e3,
  logger,
}: {
  server: Server;
  gracefulTerminationTimeout?: number;
  logger?: ActualLogger;
}) => {
  // @todo might be enough with one
  const sockets = new Set<Duplex>();
  const secureSockets = new Set<Duplex>();

  let terminating: Promise<void> | undefined;

  server.on("connection", (socket) => {
    if (terminating) {
      socket.destroy();
    } else {
      sockets.add(socket);

      socket.once("close", () => {
        sockets.delete(socket);
      });
    }
  });

  server.on("secureConnection", (socket) => {
    if (terminating) {
      socket.destroy();
    } else {
      secureSockets.add(socket);

      socket.once("close", () => {
        secureSockets.delete(socket);
      });
    }
  });

  /**
   * Evaluate whether additional steps are required to destroy the socket.
   *
   * @see https://github.com/nodejs/node/blob/57bd715d527aba8dae56b975056961b0e429e91e/lib/_http_client.js#L363-L413
   */
  const destroySocket = (socket: Duplex) => {
    socket.destroy();

    if (hasHttpServer(socket)) {
      sockets.delete(socket);
    } else {
      secureSockets.delete(socket);
    }
  };

  const shutdown = async () => {
    if (terminating) {
      logger?.warn("Already terminating HTTP server");
      return terminating;
    }

    let resolveTerminating: () => void;
    let rejectTerminating: (error: Error) => void;

    // @todo all code below must be inside
    terminating = new Promise((resolve, reject) => {
      resolveTerminating = resolve;
      rejectTerminating = reject;
    });

    server.on("request", (incomingMessage, outgoingMessage) => {
      if (!outgoingMessage.headersSent) {
        outgoingMessage.setHeader("connection", "close");
      }
    });

    // @todo looks like the same treatment
    for (const socket of sockets) {
      // This is the HTTP CONNECT request socket.
      if (!hasHttpServer(socket)) {
        continue;
      }

      if (hasResponse(socket)) {
        if (!socket._httpMessage.headersSent) {
          socket._httpMessage.setHeader("connection", "close");
        }

        continue;
      }

      destroySocket(socket);
    }

    for (const socket of secureSockets) {
      if (hasResponse(socket)) {
        if (!socket._httpMessage.headersSent) {
          socket._httpMessage.setHeader("connection", "close");
        }

        continue;
      }

      destroySocket(socket);
    }

    // Wait for all in-flight connections to drain, forcefully terminating any
    // open connections after the given timeout
    try {
      // @todo do not use
      await vi.waitFor(
        () => assert(sockets.size === 0 && secureSockets.size === 0), // @todo do not use
        { interval: 10, timeout: gracefulTerminationTimeout },
      );
    } catch {
      // Ignore timeout errors
    } finally {
      for (const socket of sockets) {
        destroySocket(socket);
      }

      for (const socket of secureSockets) {
        destroySocket(socket);
      }
    }

    server.close((error) => {
      if (error) {
        rejectTerminating(error);
      } else {
        resolveTerminating();
      }
    });

    return terminating;
  };

  return {
    secureSockets,
    sockets,
    shutdown,
  };
};
