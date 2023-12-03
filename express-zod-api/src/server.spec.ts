import { omit } from "ramda";
import { makeRequestMock } from "./testing";
import { givePort } from "../../tests/helpers";
import {
  appMock,
  compressionMock,
  expressJsonMock,
  expressMock,
  fileUploadMock,
} from "../../tests/express-mock";
import {
  createHttpsServerSpy,
  httpListenSpy,
  httpsListenSpy,
} from "../../tests/http-mock";
import winston from "winston";
import { z } from "zod";
import {
  EndpointsFactory,
  attachRouting,
  createServer,
  defaultResultHandler,
} from "./index";
import { AppConfig, ServerConfig } from "./config-type";
import { mimeJson } from "./mime";
import { createNotFoundHandler, createParserFailureHandler } from "./server";
import express, { Request, Response } from "express";

describe("Server", () => {
  afterAll(() => {
    jest.restoreAllMocks();
  });

  test("Express is mocked", () => {
    expect(expressMock).toBeTruthy();
  });

  describe("createServer()", () => {
    test("Should create server with minimal config", async () => {
      const port = givePort();
      const configMock: ServerConfig = {
        server: {
          listen: port,
        },
        cors: true,
        startupLogo: false,
        logger: { level: "warn" },
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
      await createServer(configMock, routingMock);
      expect(appMock).toBeTruthy();
      expect(appMock.disable).toHaveBeenCalledWith("x-powered-by");
      expect(appMock.use).toHaveBeenCalledTimes(3);
      expect(appMock.use.mock.calls[0][0]).toBe(expressJsonMock);
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.post).toHaveBeenCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/test");
      expect(httpListenSpy).toHaveBeenCalledTimes(1);
      expect(httpListenSpy).toHaveBeenCalledWith(port, expect.any(Function));
    });

    test("Should create server with custom JSON parser, logger and error handler", async () => {
      const customLogger = winston.createLogger({ silent: true });
      const infoMethod = jest.spyOn(customLogger, "info");
      const port = givePort();
      const configMock = {
        server: {
          listen: { port }, // testing Net::ListenOptions
          jsonParser: jest.fn(),
        },
        cors: true,
        startupLogo: false,
        errorHandler: {
          handler: jest.fn(),
        },
        logger: customLogger,
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
      const { logger, app } = await createServer(
        configMock as unknown as ServerConfig,
        routingMock,
      );
      expect(logger).toEqual(customLogger);
      expect(app).toEqual(appMock);
      expect(appMock).toBeTruthy();
      expect(appMock.use).toHaveBeenCalledTimes(3);
      expect(appMock.use.mock.calls[0][0]).toBe(configMock.server.jsonParser);
      expect(configMock.errorHandler.handler).toHaveBeenCalledTimes(0);
      expect(infoMethod).toHaveBeenCalledTimes(1);
      expect(infoMethod).toHaveBeenCalledWith(`Listening`, { port });
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.post).toHaveBeenCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/test");
      expect(httpListenSpy).toHaveBeenCalledTimes(1);
      expect(httpListenSpy).toHaveBeenCalledWith(
        { port },
        expect.any(Function),
      );
    });

    test("should create a HTTPS server on request", async () => {
      const configMock = {
        server: { listen: givePort() },
        https: {
          listen: givePort(),
          options: {
            cert: "cert",
            key: "key",
          },
        },
        cors: true,
        startupLogo: false,
        logger: { level: "warn" },
      } satisfies ServerConfig;
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

      const { httpsServer } = await createServer(configMock, routingMock);
      expect(httpsServer).toBeTruthy();
      expect(createHttpsServerSpy).toHaveBeenCalledWith(
        configMock.https.options,
        appMock,
      );
      expect(httpsListenSpy).toHaveBeenCalledTimes(1);
      expect(httpsListenSpy).toHaveBeenCalledWith(
        configMock.https.listen,
        expect.any(Function),
      );
    });

    test("should enable compression on request", async () => {
      const configMock = {
        server: {
          listen: givePort(),
          compression: true,
        },
        cors: true,
        startupLogo: false,
        logger: { level: "warn" },
      } satisfies ServerConfig;
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
      await createServer(configMock, routingMock);
      expect(appMock.use).toHaveBeenCalledTimes(4);
      expect(compressionMock).toHaveBeenCalledTimes(1);
      expect(compressionMock).toHaveBeenCalledWith(undefined);
    });

    test("should enable uploads on request", async () => {
      const configMock = {
        server: {
          listen: givePort(),
          upload: true,
        },
        cors: true,
        startupLogo: false,
        logger: { level: "warn" },
      } satisfies ServerConfig;
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
      await createServer(configMock, routingMock);
      expect(appMock.use).toHaveBeenCalledTimes(4);
      expect(fileUploadMock).toHaveBeenCalledTimes(1);
      expect(fileUploadMock).toHaveBeenCalledWith({
        abortOnLimit: false,
        parseNested: true,
      });
    });

    test("should enable raw on request", async () => {
      const rawParserMock = jest.fn();
      const configMock = {
        server: {
          listen: givePort(),
          rawParser: rawParserMock,
        },
        cors: true,
        startupLogo: false,
        logger: { level: "warn" },
      } satisfies ServerConfig;
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
      await createServer(configMock, routingMock);
      expect(appMock.use).toHaveBeenCalledTimes(5);
      const rawPropMw = appMock.use.mock.calls[2][0]; // custom middleware for raw
      expect(typeof rawPropMw).toBe("function");
      const buffer = Buffer.from([]);
      const requestMock = makeRequestMock({
        fnMethod: jest.fn,
        requestProps: {
          method: "POST",
          body: buffer,
        },
      });
      rawPropMw(requestMock, {}, jest.fn());
      expect(requestMock.body).toEqual({ raw: buffer });
    });
  });

  describe("createParserFailureHandler()", () => {
    test("the handler should call next if there is no error", () => {
      const logger = winston.createLogger({ silent: true });
      const handler = createParserFailureHandler(defaultResultHandler, logger);
      const next = jest.fn();
      handler(
        undefined,
        null as unknown as Request,
        null as unknown as Response,
        next,
      );
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe("createNotFoundHandler()", () => {
    test("the handler should call ResultHandler with 404 error", () => {
      const logger = winston.createLogger({ silent: true });
      const resultHandler = {
        ...defaultResultHandler,
        handler: jest.fn(),
      };
      const handler = createNotFoundHandler(resultHandler, logger);
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
        next,
      );
      expect(next).toHaveBeenCalledTimes(0);
      expect(resultHandler.handler).toHaveBeenCalledTimes(1);
      expect(resultHandler.handler.mock.calls[0]).toHaveLength(1);
      expect(resultHandler.handler.mock.calls[0][0]).toHaveProperty("logger");
      expect(resultHandler.handler.mock.calls[0][0].logger).toEqual(logger);
      expect(
        omit(["logger"], resultHandler.handler.mock.calls[0][0]),
      ).toMatchSnapshot();
    });

    test("should call Last Resort Handler in case of ResultHandler is faulty", () => {
      const logger = winston.createLogger({ silent: true });
      const resultHandler = {
        ...defaultResultHandler,
        handler: jest.fn().mockImplementation(() => {
          throw new Error("I am faulty");
        }),
      };
      const handler = createNotFoundHandler(resultHandler, logger);
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
        next,
      );
      expect(next).toHaveBeenCalledTimes(0);
      expect(resultHandler.handler).toHaveBeenCalledTimes(1);
      expect(responseMock.status).toHaveBeenCalledTimes(1);
      expect(responseMock.status.mock.calls[0][0]).toBe(500);
      expect(responseMock.end).toHaveBeenCalledTimes(1);
      expect(responseMock.end.mock.calls[0][0]).toBe(
        "An error occurred while serving the result: I am faulty.\n" +
          "Original error: Can not POST /v1/test.",
      );
    });
  });

  describe("attachRouting()", () => {
    test("should attach routing to the custom express app", async () => {
      const app = express();
      expect(appMock).toBeTruthy();
      const customLogger = winston.createLogger({ silent: true });
      const infoMethod = jest.spyOn(customLogger, "info");
      const configMock = {
        app,
        cors: true,
        startupLogo: false,
        errorHandler: {
          handler: jest.fn(),
        },
        logger: customLogger,
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
      const { logger, notFoundHandler } = await attachRouting(
        configMock as unknown as AppConfig,
        routingMock,
      );
      expect(logger).toEqual(customLogger);
      expect(typeof notFoundHandler).toBe("function");
      expect(appMock.use).toHaveBeenCalledTimes(0);
      expect(configMock.errorHandler.handler).toHaveBeenCalledTimes(0);
      expect(infoMethod).toHaveBeenCalledTimes(0);
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.post).toHaveBeenCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/test");
    });
  });
});
