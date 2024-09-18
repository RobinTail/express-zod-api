import http from "node:http";
import type { Socket, Server } from "node:net";

/** faster implementation than instanceof for using only the checked methods */
export const hasResponse = (
  socket: Socket,
): socket is typeof socket & {
  _httpMessage: Pick<http.ServerResponse, "headersSent" | "setHeader">;
} =>
  "_httpMessage" in socket &&
  typeof socket._httpMessage === "object" &&
  socket._httpMessage !== null &&
  "headersSent" in socket._httpMessage &&
  typeof socket._httpMessage.headersSent === "boolean" &&
  "setHeader" in socket._httpMessage &&
  typeof socket._httpMessage.setHeader === "function";

/** 6.88x faster than instanceof */
export const hasHttpServer = (socket: Socket): boolean =>
  "server" in socket &&
  typeof socket.server === "object" &&
  socket.server !== null &&
  "close" in socket.server &&
  typeof socket.server.close === "function";

/** 6.30x faster than instanceof TLSSocket */
export const isEncrypted = (socket: Socket): boolean =>
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
