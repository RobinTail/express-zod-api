import http from "node:http";
import https from "node:https";
import { MockInstance, vi } from "vitest";

const realHttpCreator = http.createServer;
const realHttpsCreator = https.createServer;

let httpListenSpy: MockInstance;
let httpsListenSpy: MockInstance;

vi.spyOn(http, "createServer").mockImplementation((app) => {
  const server = realHttpCreator(app);
  httpListenSpy = vi.spyOn(server, "listen").mockImplementation(({}, cb) => {
    cb?.call(null);
    return server;
  });
  return server;
});

const createHttpsServerSpy = vi
  .spyOn(https, "createServer")
  .mockImplementation(({}, app) => {
    const server = realHttpsCreator(app);
    httpsListenSpy = vi.spyOn(server, "listen").mockImplementation(({}, cb) => {
      cb?.call(null);
      return server;
    });
    return server;
  });

export { createHttpsServerSpy, httpsListenSpy, httpListenSpy };
