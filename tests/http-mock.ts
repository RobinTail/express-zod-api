import http from "node:http";
import https from "node:https";

const realHttpCreator = http.createServer;
const realHttpsCreator = https.createServer;

let httpListenSpy: jest.SpyInstance;
let httpsListenSpy: jest.SpyInstance;

jest.spyOn(http, "createServer").mockImplementation((app) => {
  const server = realHttpCreator(app);
  httpListenSpy = jest.spyOn(server, "listen").mockImplementation(({}, cb) => {
    cb?.call(null);
    return server;
  });
  return server;
});

const createHttpsServerSpy = jest
  .spyOn(https, "createServer")
  .mockImplementation(({}, app) => {
    const server = realHttpsCreator(app);
    httpsListenSpy = jest
      .spyOn(server, "listen")
      .mockImplementation(({}, cb) => {
        cb?.call(null);
        return server;
      });
    return server;
  });

export { createHttpsServerSpy, httpsListenSpy, httpListenSpy };
