import http from "node:http";
import type { Socket, Server } from "node:net";
import type { TLSSocket } from "node:tls";

export const hasResponse = (
  socket: Socket,
): socket is typeof socket & { _httpMessage: http.ServerResponse } =>
  "_httpMessage" in socket &&
  socket._httpMessage instanceof http.ServerResponse;

/** 6.88x faster than instanceof */
export const hasHttpServer = (
  socket: Socket,
): socket is typeof socket & { server: http.Server } =>
  "server" in socket &&
  typeof socket.server === "object" &&
  socket.server !== null &&
  "close" in socket.server &&
  typeof socket.server.close === "function";

/** 6.30x faster than instanceof */
export const isEncrypted = (socket: Socket): socket is TLSSocket =>
  "encrypted" in socket &&
  typeof socket.encrypted === "boolean" &&
  socket.encrypted;

export const weAreClosed: http.RequestListener = ({}, res) =>
  void (!res.headersSent && res.setHeader("connection", "close"));

export const closeAsync = (server: Server) =>
  new Promise<void>(
    (resolve, reject) =>
      void server.close((error) => (error ? reject(error) : resolve())),
  );
