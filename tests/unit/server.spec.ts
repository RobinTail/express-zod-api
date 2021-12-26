import http from "http";

let appMock: ReturnType<typeof newAppMock>;
const expressJsonMock = jest.fn();
const newAppMock = () => ({
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

const expressMock = jest.mock("express", () => {
  appMock = newAppMock();
  const returnFunction = () => appMock;
  returnFunction.json = () => expressJsonMock;
  return returnFunction;
});

import express, { Request, Response } from "express"; // express is mocked above
import https from "https";
import { Logger } from "winston";
import {
  createServer,
  attachRouting,
  EndpointsFactory,
  z,
  defaultResultHandler,
} from "../../src";
import { AppConfig, CommonConfig, ServerConfig } from "../../src/config-type";
import { mimeJson } from "../../src/mime";
import {
  createNotFoundHandler,
  createParserFailureHandler,
} from "../../src/server";

describe("Server", () => {
  beforeEach(() => {
    appMock = newAppMock();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("Express is mocked", () => {
    expect(expressMock).toBeTruthy();
  });

  describe("createServer()", () => {
    test("Should create server with minimal config", () => {
      const configMock: ServerConfig & CommonConfig = {
        server: {
          listen: 8054,
        },
        cors: true,
        startupLogo: false,
        logger: {
          level: "warn",
          color: false,
        },
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler).build({
            methods: ["get", "post"],
            input: z.object({
              n: z.number(),
            }),
            output: z.object({
              b: z.boolean(),
            }),
            handler: jest.fn(),
          }),
        },
      };
      createServer(configMock, routingMock);
      expect(appMock).toBeTruthy();
      expect(appMock.use).toBeCalledTimes(3);
      expect(Array.isArray(appMock.use.mock.calls[0][0])).toBeTruthy();
      expect(appMock.use.mock.calls[0][0][0]).toBe(expressJsonMock);
      expect(appMock.get).toBeCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.post).toBeCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.options).toBeCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.listen).toBeCalledTimes(1);
      expect(appMock.listen.mock.calls[0][0]).toBe(8054);
    });

    test("Should create server with custom JSON parser, logger and error handler", () => {
      const configMock = {
        server: {
          listen: 8054,
          jsonParser: jest.fn(),
        },
        cors: true,
        startupLogo: false,
        errorHandler: {
          handler: jest.fn(),
        },
        logger: {
          info: jest.fn(),
        },
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler).build({
            methods: ["get", "post"],
            input: z.object({
              n: z.number(),
            }),
            output: z.object({
              b: z.boolean(),
            }),
            handler: jest.fn(),
          }),
        },
      };
      const { httpServer, logger, app } = createServer(
        configMock as unknown as ServerConfig & CommonConfig,
        routingMock
      );
      expect(httpServer).toBeInstanceOf(http.Server);
      expect(logger).toEqual(configMock.logger);
      expect(app).toEqual(appMock);
      expect(appMock).toBeTruthy();
      expect(appMock.use).toBeCalledTimes(3);
      expect(Array.isArray(appMock.use.mock.calls[0][0])).toBeTruthy();
      expect(appMock.use.mock.calls[0][0][0]).toBe(
        configMock.server.jsonParser
      );
      expect(configMock.errorHandler.handler).toBeCalledTimes(0);
      expect(configMock.logger.info).toBeCalledTimes(1);
      expect(configMock.logger.info).toBeCalledWith("Listening 8054");
      expect(appMock.get).toBeCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.post).toBeCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.options).toBeCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.listen).toBeCalledTimes(1);
      expect(appMock.listen.mock.calls[0][0]).toBe(8054);
    });

    test("should create a HTTPS server on request", () => {
      const configMock = {
        server: {
          listen: 8054,
          jsonParser: jest.fn(),
        },
        https: {
          listen: 8443,
          options: {
            cert: "cert",
            key: "key",
          },
        },
        cors: true,
        startupLogo: false,
        errorHandler: {
          handler: jest.fn(),
        },
        logger: {
          info: jest.fn(),
        },
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler).build({
            method: "get",
            input: z.object({}),
            output: z.object({}),
            handler: jest.fn(),
          }),
        },
      };
      let httpsServerMock: { listen: jest.Mock } | undefined = undefined;
      jest.spyOn(https, "createServer").mockImplementation(() => {
        httpsServerMock = {
          listen: jest.fn((port, cb) => {
            cb();
            return httpsServerMock;
          }),
        };
        return httpsServerMock as unknown as https.Server;
      });

      const { httpServer, httpsServer } = createServer(
        configMock as unknown as ServerConfig & CommonConfig,
        routingMock
      );
      expect(httpServer).toBeInstanceOf(http.Server);
      expect(httpsServer).toEqual(httpsServerMock);
      expect(httpsServerMock).toBeTruthy();
      expect(https.createServer).toHaveBeenCalledWith(
        configMock.https.options,
        appMock
      );
      expect(httpsServerMock!.listen).toBeCalledTimes(1);
      expect(httpsServerMock!.listen.mock.calls[0][0]).toBe(
        configMock.https.listen
      );
    });
  });

  describe("createParserFailureHandler()", () => {
    test("the handler should call next if there is no error", () => {
      const loggerMock = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const handler = createParserFailureHandler(
        defaultResultHandler,
        loggerMock as unknown as Logger
      );
      const next = jest.fn();
      handler(
        undefined,
        null as unknown as Request,
        null as unknown as Response,
        next
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("createNotFoundHandler()", () => {
    test("the handler should call ResultHandler with 404 error", () => {
      const loggerMock = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const resultHandler = {
        ...defaultResultHandler,
        handler: jest.fn(),
      };
      const handler = createNotFoundHandler(
        resultHandler,
        loggerMock as unknown as Logger
      );
      const next = jest.fn();
      const requestMock = {
        method: "POST",
        path: "/v1/test",
        header: jest.fn(() => mimeJson),
        body: {
          n: 453,
        },
      };
      const responseMock: Record<string, jest.Mock> = {
        end: jest.fn(),
        set: jest.fn().mockImplementation(() => responseMock),
        status: jest.fn().mockImplementation(() => responseMock),
        json: jest.fn().mockImplementation(() => responseMock),
      };
      handler(
        requestMock as unknown as Request,
        responseMock as unknown as Response,
        next
      );
      expect(next).toHaveBeenCalledTimes(0);
      expect(resultHandler.handler).toHaveBeenCalledTimes(1);
      expect(resultHandler.handler.mock.calls[0]).toMatchSnapshot();
    });

    test("should call Last Resort Handler in case of ResultHandler is faulty", () => {
      const loggerMock = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
      };
      const resultHandler = {
        ...defaultResultHandler,
        handler: jest.fn().mockImplementation(() => {
          throw new Error("I am faulty");
        }),
      };
      const handler = createNotFoundHandler(
        resultHandler,
        loggerMock as unknown as Logger
      );
      const next = jest.fn();
      const requestMock = {
        method: "POST",
        path: "/v1/test",
        header: jest.fn(() => mimeJson),
        body: {
          n: 453,
        },
      };
      const responseMock: Record<string, jest.Mock> = {
        end: jest.fn(),
        set: jest.fn().mockImplementation(() => responseMock),
        status: jest.fn().mockImplementation(() => responseMock),
        json: jest.fn().mockImplementation(() => responseMock),
      };
      handler(
        requestMock as unknown as Request,
        responseMock as unknown as Response,
        next
      );
      expect(next).toHaveBeenCalledTimes(0);
      expect(resultHandler.handler).toHaveBeenCalledTimes(1);
      expect(responseMock.status).toHaveBeenCalledTimes(1);
      expect(responseMock.status.mock.calls[0][0]).toBe(500);
      expect(responseMock.end).toHaveBeenCalledTimes(1);
      expect(responseMock.end.mock.calls[0][0]).toBe(
        "An error occurred while serving the result: I am faulty.\n" +
          "Original error: Can not POST /v1/test."
      );
    });
  });

  describe("attachRouting()", () => {
    test("should attach routing to the custom express app", () => {
      const app = express();
      expect(appMock).toBeTruthy();
      const configMock = {
        app,
        cors: true,
        startupLogo: false,
        errorHandler: {
          handler: jest.fn(),
        },
        logger: {
          info: jest.fn(),
        },
      };
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler).build({
            methods: ["get", "post"],
            input: z.object({
              n: z.number(),
            }),
            output: z.object({
              b: z.boolean(),
            }),
            handler: jest.fn(),
          }),
        },
      };
      const { logger, notFoundHandler } = attachRouting(
        configMock as unknown as AppConfig & CommonConfig,
        routingMock
      );
      expect(logger).toEqual(configMock.logger);
      expect(typeof notFoundHandler).toBe("function");
      expect(appMock.use).toBeCalledTimes(0);
      expect(configMock.errorHandler.handler).toBeCalledTimes(0);
      expect(configMock.logger.info).toBeCalledTimes(0);
      expect(appMock.listen).toBeCalledTimes(0);
      expect(appMock.get).toBeCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.post).toBeCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.options).toBeCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/test");
      app.listen(8054);
      expect(appMock.listen).toBeCalledTimes(1);
      expect(appMock.listen.mock.calls[0][0]).toBe(8054);
    });
  });
});
