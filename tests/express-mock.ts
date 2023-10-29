// @see https://github.com/swc-project/jest/issues/14#issuecomment-970189585
import http from "node:http";
import https from "node:https";

const expressJsonMock = jest.fn();
const compressionMock = jest.fn();
const fileUploadMock = jest.fn();
jest.mock("compression", () => compressionMock);
jest.mock("express-fileupload", () => fileUploadMock);

const staticHandler = jest.fn();
const staticMock = jest.fn(() => staticHandler);

let appMock: Record<"disable" | "use" | "get" | "post" | "options", jest.Mock>;

const appCreatorMock = () => {
  appMock = {
    disable: jest.fn(() => appMock),
    use: jest.fn(() => appMock),
    get: jest.fn(),
    post: jest.fn(),
    options: jest.fn(),
  };
  return appMock;
};
appCreatorMock.json = () => expressJsonMock;
appCreatorMock.static = staticMock;

const expressMock = jest.mock("express", () => appCreatorMock);

const actualCreateHttpServer = http.createServer;
const actualCreateHttpsServer = https.createServer;

let httpServerListenSpy: jest.SpyInstance;
let httpsServerListenSpy: jest.SpyInstance;
jest.spyOn(http, "createServer").mockImplementation((app) => {
  const server = actualCreateHttpServer(app);
  httpServerListenSpy = jest.spyOn(server, "listen");
  return server;
});
const createHttpsServerSpy = jest
  .spyOn(https, "createServer")
  .mockImplementation((options, app) => {
    const server = actualCreateHttpsServer(app);
    httpsServerListenSpy = jest.spyOn(server, "listen");
    return server;
  });

export {
  compressionMock,
  fileUploadMock,
  expressMock,
  appMock,
  expressJsonMock,
  staticMock,
  staticHandler,
  httpServerListenSpy,
  createHttpsServerSpy,
  httpsServerListenSpy,
};
