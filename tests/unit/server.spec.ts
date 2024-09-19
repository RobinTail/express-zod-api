import { moveRaw } from "../../src/server-helpers";
import { givePort } from "../helpers";
import {
  appMock,
  compressionMock,
  expressJsonMock,
  expressMock,
  expressRawMock,
} from "../express-mock";
import {
  createHttpsServerSpy,
  httpListenSpy,
  httpsListenSpy,
} from "../http-mock";
import { z } from "zod";
import {
  AppConfig,
  BuiltinLogger,
  EndpointsFactory,
  ServerConfig,
  attachRouting,
  createServer,
  defaultResultHandler,
  ez,
} from "../../src";
import express from "express";

describe("Server", () => {
  afterAll(() => {
    vi.restoreAllMocks();
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
            handler: vi.fn(),
          }),
        },
      };
      await createServer(configMock, routingMock);
      expect(appMock).toBeTruthy();
      expect(appMock.disable).toHaveBeenCalledWith("x-powered-by");
      expect(appMock.use).toHaveBeenCalledTimes(2);
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/test",
        expressJsonMock,
        expect.any(Function), // endpoint
      );
      expect(appMock.post).toHaveBeenCalledTimes(1);
      expect(appMock.post).toHaveBeenCalledWith(
        "/v1/test",
        expressJsonMock,
        expect.any(Function), // endpoint
      );
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options).toHaveBeenCalledWith(
        "/v1/test",
        expressJsonMock,
        expect.any(Function), // endpoint
      );
      expect(httpListenSpy).toHaveBeenCalledTimes(1);
      expect(httpListenSpy).toHaveBeenCalledWith(port, expect.any(Function));
    });

    test("Should create server with custom JSON parser, raw parser, logger, error handler and beforeRouting", async () => {
      const customLogger = new BuiltinLogger({ level: "silent" });
      const infoMethod = vi.spyOn(customLogger, "info");
      const port = givePort();
      const configMock = {
        server: {
          listen: { port }, // testing Net::ListenOptions
          jsonParser: vi.fn(),
          rawParser: vi.fn(),
          beforeRouting: vi.fn(),
        },
        cors: true,
        startupLogo: false,
        errorHandler: {
          handler: vi.fn(),
        },
        logger: customLogger,
      };
      const factory = new EndpointsFactory(defaultResultHandler);
      const routingMock = {
        v1: {
          test: factory.build({
            methods: ["get", "post"],
            input: z.object({
              n: z.number(),
            }),
            output: z.object({
              b: z.boolean(),
            }),
            handler: vi.fn(),
          }),
          raw: factory.build({
            method: "patch",
            input: ez.raw(),
            output: z.object({}),
            handler: vi.fn(),
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
      expect(appMock.use).toHaveBeenCalledTimes(2);
      expect(configMock.errorHandler.handler).toHaveBeenCalledTimes(0);
      expect(configMock.server.beforeRouting).toHaveBeenCalledWith({
        app: appMock,
        logger: customLogger,
        getChildLogger: expect.any(Function),
      });
      expect(infoMethod).toHaveBeenCalledTimes(1);
      expect(infoMethod).toHaveBeenCalledWith(`Listening`, { port });
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/test",
        configMock.server.jsonParser,
        expect.any(Function), // endpoint
      );
      expect(appMock.post).toHaveBeenCalledTimes(1);
      expect(appMock.post).toHaveBeenCalledWith(
        "/v1/test",
        configMock.server.jsonParser,
        expect.any(Function), // endpoint
      );
      expect(appMock.patch).toHaveBeenCalledTimes(1);
      expect(appMock.patch).toHaveBeenCalledWith(
        "/v1/raw",
        configMock.server.rawParser,
        moveRaw,
        expect.any(Function), // endpoint
      );
      expect(appMock.options).toHaveBeenCalledTimes(2);
      expect(appMock.options).toHaveBeenCalledWith(
        "/v1/test",
        configMock.server.jsonParser,
        expect.any(Function), // endpoint
      );
      expect(appMock.options).toHaveBeenCalledWith(
        "/v1/raw",
        configMock.server.rawParser,
        moveRaw,
        expect.any(Function), // endpoint
      );
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
            handler: vi.fn(),
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
            handler: vi.fn(),
          }),
        },
      };
      await createServer(configMock, routingMock);
      expect(appMock.use).toHaveBeenCalledTimes(3);
      expect(compressionMock).toHaveBeenCalledTimes(1);
      expect(compressionMock).toHaveBeenCalledWith(undefined);
    });

    test("should enable uploads on request", async () => {
      const configMock = {
        server: {
          listen: givePort(),
          upload: {
            limits: { fileSize: 1024 },
            limitError: new Error("Too heavy"),
            beforeUpload: vi.fn(),
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
            input: z.object({
              file: ez.upload(),
            }),
            output: z.object({}),
            handler: vi.fn(),
          }),
        },
      };
      await createServer(configMock, routingMock);
      expect(appMock.use).toHaveBeenCalledTimes(2);
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/test",
        expect.any(Function), // uploader with logger
        expect.any(Function), // createUploadFailueHandler()
        expect.any(Function), // endpoint
      );
    });

    test("should enable raw on request", async () => {
      const configMock = {
        server: {
          listen: givePort(),
        },
        cors: true,
        startupLogo: false,
        logger: { level: "warn" },
      } satisfies ServerConfig;
      const routingMock = {
        v1: {
          test: new EndpointsFactory(defaultResultHandler).build({
            method: "get",
            input: ez.raw(),
            output: z.object({}),
            handler: vi.fn(),
          }),
        },
      };
      await createServer(configMock, routingMock);
      expect(appMock.use).toHaveBeenCalledTimes(2);
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/test",
        expressRawMock,
        moveRaw,
        expect.any(Function), // endpoint
      );
    });
  });

  describe("attachRouting()", () => {
    test("should attach routing to the custom express app", () => {
      const app = express();
      expect(appMock).toBeTruthy();
      const customLogger = new BuiltinLogger({ level: "silent" });
      const infoMethod = vi.spyOn(customLogger, "info");
      const configMock = {
        app,
        cors: true,
        startupLogo: false,
        errorHandler: {
          handler: vi.fn(),
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
            handler: vi.fn(),
          }),
        },
      };
      const { logger, notFoundHandler } = attachRouting(
        configMock as unknown as AppConfig,
        routingMock,
      );
      expect(logger).toEqual(customLogger);
      expect(typeof notFoundHandler).toBe("function");
      expect(appMock.use).toHaveBeenCalledTimes(1); // createLoggingMiddleware
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
