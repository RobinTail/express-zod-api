import http from "node:http";
import https from "node:https";
import type { MockInstance } from "vitest";
import type { Application } from "express";

const realHttpCreator = http.createServer;
const realHttpsCreator = https.createServer;

let httpListenSpy: MockInstance;
let httpsListenSpy: MockInstance;

vi.spyOn(http, "createServer").mockImplementation((app) => {
  const server = realHttpCreator(app as Application);
  httpListenSpy = vi.spyOn(server, "listen").mockImplementation(({}, cb) => {
    if (typeof cb === "function") cb();
    return server;
  });
  return server;
});

const createHttpsServerSpy = vi
  .spyOn(https, "createServer")
  .mockImplementation((...args) => {
    const server = realHttpsCreator(args[1] as Application);
    httpsListenSpy = vi.spyOn(server, "listen").mockImplementation(({}, cb) => {
      if (typeof cb === "function") cb();
      return server;
    });
    return server;
  });

export { createHttpsServerSpy, httpsListenSpy, httpListenSpy };
