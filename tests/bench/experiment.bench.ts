import http from "node:http";
import { Socket } from "node:net";
import { TLSSocket } from "node:tls";
import { bench } from "vitest";
import { hasHttpServer } from "../../src/graceful-helpers";

const comparable = (
  socket: Socket,
): socket is typeof socket & { server: http.Server } =>
  "server" in socket &&
  typeof socket.server === "object" &&
  socket.server !== null &&
  "close" in socket.server &&
  typeof socket.server.close === "function";

describe("Experiment %s", () => {
  const a = new Socket();
  const b = { server: http.createServer() };

  bench("original", () => {
    hasHttpServer(a);
    hasHttpServer(b as unknown as Socket);
  });

  bench("featured", () => {
    comparable(a);
    comparable(b as unknown as Socket);
  });
});
