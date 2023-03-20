// @see https://github.com/swc-project/jest/issues/14#issuecomment-970189585
import http from "http";

const expressJsonMock = jest.fn();
const compressionMock = jest.fn();
jest.mock("compression", () => compressionMock);

const staticHandler = jest.fn();
const staticMock = jest.fn(() => staticHandler);

let appMock: Record<
  "disable" | "use" | "listen" | "get" | "post" | "options",
  jest.Mock
>;

const appCreatorMock = () => {
  appMock = {
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
  };
  return appMock;
};
appCreatorMock.json = () => expressJsonMock;
appCreatorMock.static = staticMock;

const expressMock = jest.mock("express", () => appCreatorMock);

export {
  compressionMock,
  expressMock,
  appMock,
  expressJsonMock,
  staticMock,
  staticHandler,
};
