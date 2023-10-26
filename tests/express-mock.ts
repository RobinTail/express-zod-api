// @see https://github.com/swc-project/jest/issues/14#issuecomment-970189585
import http from "node:http";

const expressJsonMock = jest.fn();

const staticHandler = jest.fn();
const staticMock = jest.fn(() => staticHandler);

let appMock: Record<
  "disable" | "use" | "listen" | "get" | "post" | "options",
  jest.Mock
>;

const appCreatorMock = () => {
  appMock = {
    disable: jest.fn(() => appMock),
    use: jest.fn(() => appMock),
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

export { expressMock, appMock, expressJsonMock, staticMock, staticHandler };
