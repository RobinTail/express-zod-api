import { rawMover } from "../../src/server-helpers";
import { givePort } from "../helpers";
import {
  appMock,
  compressionMock,
  expressJsonMock,
  expressMock,
  fileUploadMock,
} from "../express-mock";
import {
  createHttpsServerSpy,
  httpListenSpy,
  httpsListenSpy,
} from "../http-mock";
import { z } from "zod";
import {
  AppConfig,
  EndpointsFactory,
  ServerConfig,
  attachRouting,
  createLogger,
  createServer,
  defaultResultHandler,
  ez,
} from "../../src";
import express from "express";
import { afterAll, describe, expect, test, vi } from "vitest";

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
      expect(appMock.use).toHaveBeenCalledTimes(4);
      expect(appMock.use.mock.calls[0]).toEqual([
        "/v1/test",
        [expressJsonMock],
      ]);
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.post).toHaveBeenCalledTimes(1);
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/test");
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/test");
      expect(httpListenSpy).toHaveBeenCalledTimes(1);
      expect(httpListenSpy).toHaveBeenCalledWith(port, expect.any(Function));
    });

    test("Should create server with custom JSON parser, logger, error handler and beforeRouting", async () => {
      const customLogger = createLogger({ level: "silent" });
      const infoMethod = vi.spyOn(customLogger, "info");
      const port = givePort();
      const configMock = {
        server: {
          listen: { port }, // testing Net::ListenOptions
          jsonParser: vi.fn(),
          beforeRouting: vi.fn(),
        },
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
      const { logger, app } = await createServer(
        configMock as unknown as ServerConfig,
        routingMock,
      );
      expect(logger).toEqual(customLogger);
      expect(app).toEqual(appMock);
      expect(appMock).toBeTruthy();
      expect(appMock.use).toHaveBeenCalledTimes(4);
      expect(appMock.use.mock.calls[0]).toEqual([
        "/v1/test",
        [configMock.server.jsonParser],
      ]);
      expect(configMock.errorHandler.handler).toHaveBeenCalledTimes(0);
      expect(configMock.server.beforeRouting).toHaveBeenCalledWith({
        app: appMock,
        logger: customLogger,
      });
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
      expect(appMock.use).toHaveBeenCalledTimes(4);
      expect(compressionMock).toHaveBeenCalledTimes(1);
      expect(compressionMock).toHaveBeenCalledWith(undefined);
    });

    test("should enable uploads on request", async () => {
      const beforeUpload = vi.fn();
      const uploader = vi.fn();
      fileUploadMock.mockImplementationOnce(() => uploader);
      const configMock = {
        server: {
          listen: givePort(),
          upload: {
            limits: { fileSize: 1024 },
            limitError: new Error("Too heavy"),
            beforeUpload,
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
      expect(appMock.use).toHaveBeenCalledTimes(3);
      expect(appMock.use.mock.calls[0]).toEqual([
        "/v1/test",
        [beforeUpload, uploader, expect.any(Function)], // 3rd: createUploadFailueHandler()
      ]);
      expect(fileUploadMock).toHaveBeenCalledTimes(1);
      expect(fileUploadMock).toHaveBeenCalledWith({
        abortOnLimit: false,
        parseNested: true,
        limits: { fileSize: 1024 },
        logger: { log: expect.any(Function) },
      });
    });

    test("should enable raw on request", async () => {
      const rawParserMock = vi.fn();
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
            input: ez.raw(),
            output: z.object({}),
            handler: vi.fn(),
          }),
        },
      };
      await createServer(configMock, routingMock);
      expect(appMock.use).toHaveBeenCalledTimes(3);
      expect(appMock.use.mock.calls[0]).toEqual([
        "/v1/test",
        [rawParserMock, rawMover],
      ]);
    });
  });

  describe("attachRouting()", () => {
    test("should attach routing to the custom express app", () => {
      const app = express();
      expect(appMock).toBeTruthy();
      const customLogger = createLogger({ level: "silent" });
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
