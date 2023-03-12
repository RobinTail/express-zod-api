// @see https://github.com/swc-project/jest/issues/14#issuecomment-970189585
import http from "http";

const compressionMock = jest.fn();
jest.mock("compression", () => compressionMock);

const staticHandler = jest.fn();
const staticMock = jest.fn(() => staticHandler);

let appMock: ReturnType<typeof newAppMock>;
const expressJsonMock = jest.fn();
const newAppMock = () => ({
  disable: jest.fn(),
  use: jest.fn(),
  listen: jest.fn((port, cb) => {
    if (cb) {
      cb();
    }
    return new http.Server();
  }),
  get: jest.fn(),
  post: jest.fn(),
  options: jest.fn(),
});

const renewApp = () => {
  appMock = newAppMock();
  return appMock;
};
renewApp.json = () => expressJsonMock;
renewApp.static = staticMock;

const expressMock = jest.mock("express", () => renewApp);

export {
  compressionMock,
  expressMock,
  appMock,
  expressJsonMock,
  staticMock,
  staticHandler,
};
