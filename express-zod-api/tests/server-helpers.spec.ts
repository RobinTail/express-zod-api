import { z } from "zod";
import {
  appMock,
  expressMock,
  fileUploadMock,
  staticHandler,
  staticMock,
} from "./express-mock";
import { metaSymbol } from "../src/metadata";
import {
  createLoggingMiddleware,
  createNotFoundHandler,
  createCatcher,
  createUploadFailureHandler,
  createUploadLogger,
  createUploadParsers,
  makeGetLogger,
  moveRaw,
  installDeprecationListener,
  installTerminationListener,
  initRouting,
  createWrongMethodHandler,
} from "../src/server-helpers";
import {
  CommonConfig,
  defaultResultHandler,
  DependsOnMethod,
  EndpointsFactory,
  ez,
  ResultHandler,
  Routing,
  ServeStatic,
} from "../src";
import { type IRouter, Request, type RequestHandler } from "express";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../src/testing";
import createHttpError from "http-errors";

describe("Server helpers", () => {
  describe("createCatcher()", () => {
    test("the handler should call next if there is no error", () => {
      const handler = createCatcher({
        errorHandler: defaultResultHandler,
        getLogger: () => makeLoggerMock(),
      });
      const next = vi.fn();
      handler(undefined, makeRequestMock(), makeResponseMock(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test.each([
      new SyntaxError("Unexpected end of JSON input"),
      createHttpError(400, "Unexpected end of JSON input"),
    ])(
      "the handler should call error handler with correct error code %#",
      async (error) => {
        const errorHandler = new ResultHandler({
          positive: vi.fn(),
          negative: vi.fn(),
          handler: vi.fn(),
        });
        const spy = vi.spyOn(errorHandler, "execute");
        const handler = createCatcher({
          errorHandler,
          getLogger: () => makeLoggerMock(),
        });
        await handler(
          error,
          makeRequestMock(),
          makeResponseMock(),
          vi.fn<any>(),
        );
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].error).toEqual(
          createHttpError(400, "Unexpected end of JSON input"),
        );
      },
    );
  });

  describe("createNotFoundHandler()", () => {
    test("the handler should call ResultHandler with 404 error", async () => {
      const errorHandler = new ResultHandler({
        positive: vi.fn(),
        negative: vi.fn(),
        handler: vi.fn(),
      });
      const spy = vi.spyOn(errorHandler, "execute");
      const handler = createNotFoundHandler({
        errorHandler,
        getLogger: () => makeLoggerMock(),
      });
      const next = vi.fn();
      const requestMock = makeRequestMock({
        method: "POST",
        path: "/v1/test",
        body: { n: 453 },
      });
      const responseMock = makeResponseMock();
      await handler(requestMock, responseMock, next);
      expect(next).toHaveBeenCalledTimes(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]).toHaveLength(1);
      expect(spy.mock.calls[0][0].error).toEqual(
        createHttpError(404, "Can not POST /v1/test"),
      );
      expect(spy.mock.calls[0][0].input).toBeNull();
      expect(spy.mock.calls[0][0].output).toBeNull();
      expect(spy.mock.calls[0][0].request).toEqual(requestMock);
      expect(spy.mock.calls[0][0].response).toEqual(responseMock);
    });

    test("should call Last Resort Handler in case of ResultHandler is faulty", () => {
      const errorHandler = new ResultHandler({
        positive: vi.fn(),
        negative: vi.fn(),
        handler: vi.fn().mockImplementation(() => assert.fail("I am faulty")),
      });
      const spy = vi.spyOn(errorHandler, "execute");
      const handler = createNotFoundHandler({
        errorHandler,
        getLogger: () => makeLoggerMock(),
      });
      const next = vi.fn();
      const requestMock = makeRequestMock({
        method: "POST",
        path: "/v1/test",
        body: { n: 453 },
      });
      const responseMock = makeResponseMock();
      handler(requestMock, responseMock, next);
      expect(next).toHaveBeenCalledTimes(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getData()).toBe(
        "An error occurred while serving the result: I am faulty.\n" +
          "Original error: Can not POST /v1/test.",
      );
    });
  });

  describe("createUploadFailureHandler()", () => {
    const error = new Error("Too heavy");

    test.each([
      { files: { one: { truncated: true } } },
      { files: { one: [{ truncated: false }, { truncated: true }] } },
    ])("should handle truncated files by calling next with error %#", (req) => {
      const handler = createUploadFailureHandler(error);
      const next = vi.fn();
      handler(req as unknown as Request, makeResponseMock(), next);
      expect(next).toHaveBeenCalledWith(error);
    });

    test.each([
      {},
      { files: {} },
      { files: { one: { truncated: false } } },
      { file: { one: [{ truncated: false }] } },
    ])("should call next when all uploads succeeded %#", (req) => {
      const handler = createUploadFailureHandler(error);
      const next = vi.fn();
      handler(req as unknown as Request, makeResponseMock(), next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("createUploadLogger()", () => {
    const logger = makeLoggerMock();
    const uploadLogger = createUploadLogger(logger);

    test("should debug the messages", () => {
      uploadLogger.log("Express-file-upload: Busboy finished parsing request.");
      expect(logger._getLogs().debug).toEqual([
        ["Express-file-upload: Busboy finished parsing request."],
      ]);
    });
  });

  describe("createUploadParsers()", async () => {
    const loggerMock = makeLoggerMock();
    const beforeUploadMock = vi.fn();
    const parsers = await createUploadParsers({
      config: {
        http: { listen: 8090 },
        upload: {
          limits: { fileSize: 1024 },
          limitError: new Error("Too heavy"),
          beforeUpload: beforeUploadMock,
        },
        cors: false,
        logger: { level: "silent" },
      },
      getLogger: () => loggerMock,
    });
    const requestMock = makeRequestMock();
    const responseMock = makeResponseMock();
    const nextMock = vi.fn();

    test("should return an array of RequestHandler", () => {
      expect(parsers).toEqual([
        expect.any(Function), // uploader with logger
        expect.any(Function), // createUploadFailureHandler()
      ]);
    });

    test("should handle errors thrown by beforeUpload", async () => {
      const error = createHttpError(403, "Not authorized");
      beforeUploadMock.mockImplementationOnce(() => {
        throw error;
      });
      await parsers[0](requestMock, responseMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(error);
    });

    test("should install the uploader with its special logger", async () => {
      const internalMw = vi.fn();
      fileUploadMock.mockImplementationOnce(() => internalMw);
      await parsers[0](requestMock, responseMock, nextMock);
      expect(beforeUploadMock).toHaveBeenCalledWith({
        request: requestMock,
        logger: loggerMock,
      });
      expect(fileUploadMock).toHaveBeenCalledTimes(1);
      expect(fileUploadMock).toHaveBeenCalledWith({
        debug: true,
        abortOnLimit: false,
        parseNested: true,
        limits: { fileSize: 1024 },
        logger: { log: expect.any(Function) }, // @see createUploadLogger test
      });
      expect(internalMw).toHaveBeenCalledWith(
        requestMock,
        responseMock,
        nextMock,
      );
    });
  });

  describe("moveRaw()", () => {
    test("should place the body into the raw prop of the body object", () => {
      const buffer = Buffer.from([]);
      const requestMock = makeRequestMock({
        method: "POST",
        body: buffer,
      });
      const nextMock = vi.fn();
      moveRaw(requestMock, makeResponseMock(), nextMock);
      expect(requestMock.body).toEqual({ raw: buffer });
      expect(nextMock).toHaveBeenCalled();
    });
  });

  describe("createLoggingMiddleware", () => {
    const logger = makeLoggerMock();
    const child = makeLoggerMock({ isChild: true });
    test.each([undefined, () => child, async () => child])(
      "should make RequestHandler writing logger to res.locals %#",
      async (childLoggerProvider) => {
        const config = { childLoggerProvider } as CommonConfig;
        const handler = createLoggingMiddleware({ logger, config });
        expect(typeof handler).toBe("function");
        const nextMock = vi.fn();
        const response = makeResponseMock();
        const request = makeRequestMock({ path: "/test" });
        request.res = response;
        await handler(request, response, nextMock);
        expect(nextMock).toHaveBeenCalled();
        expect(
          (childLoggerProvider ? child : logger)._getLogs().debug.pop(),
        ).toEqual(["GET: /test"]);
        expect(request.res).toHaveProperty("locals", {
          [metaSymbol]: { logger: childLoggerProvider ? child : logger },
        });
      },
    );
  });

  describe("makeGetLogger()", () => {
    const logger = makeLoggerMock();
    const getLogger = makeGetLogger(logger);

    test("should extract child logger from request", () => {
      const request = makeRequestMock({
        res: {
          locals: {
            [metaSymbol]: { logger: makeLoggerMock({ isChild: true }) },
          },
        },
      });
      expect(getLogger(request)).toHaveProperty("isChild", true);
    });

    test.each([makeRequestMock(), undefined])(
      "should fall back to root %#",
      (request) => {
        expect(getLogger(request)).toEqual(logger);
      },
    );
  });

  describe("installDeprecationListener()", () => {
    test("should assign deprecation event listener on process", () => {
      const spy = vi.spyOn(process, "on").mockImplementation(vi.fn());
      const logger = makeLoggerMock();
      installDeprecationListener(logger);
      expect(spy).toHaveBeenCalledWith("deprecation", expect.any(Function));
    });
  });

  describe("installTerminationListener", () => {
    test("should install termination signal listener on process", () => {
      const spy = vi.spyOn(process, "on").mockImplementation(vi.fn());
      const logger = makeLoggerMock();
      installTerminationListener({
        servers: [],
        logger,
        options: { events: ["NOT_HAPPEN"] },
      });
      expect(spy).toHaveBeenCalledWith("NOT_HAPPEN", expect.any(Function));
    });
  });

  describe("initRouting()", () => {
    beforeAll(() => {
      expressMock();
    });

    beforeEach(() => {
      vi.clearAllMocks(); // resets call counters on mocked methods
    });

    test.each([404, 405])(
      "Should set right methods %#",
      (wrongMethodBehavior) => {
        const handlerMock = vi.fn();
        const configMock = {
          cors: true,
          startupLogo: false,
          wrongMethodBehavior,
        };
        const factory = new EndpointsFactory(defaultResultHandler);
        const getEndpoint = factory.build({
          output: z.object({}),
          handler: handlerMock,
        });
        const postEndpoint = factory.build({
          method: "post",
          output: z.object({}),
          handler: handlerMock,
        });
        const getAndPostEndpoint = factory.build({
          method: ["get", "post"],
          output: z.object({}),
          handler: handlerMock,
        });
        const routing: Routing = {
          v1: {
            user: {
              get: getEndpoint,
              set: postEndpoint,
              universal: getAndPostEndpoint,
            },
          },
        };
        const logger = makeLoggerMock();
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: configMock as CommonConfig,
          routing,
        });
        expect(appMock.get).toHaveBeenCalledTimes(2);
        expect(appMock.post).toHaveBeenCalledTimes(2);
        expect(appMock.put).toHaveBeenCalledTimes(0);
        expect(appMock.delete).toHaveBeenCalledTimes(0);
        expect(appMock.patch).toHaveBeenCalledTimes(0);
        expect(appMock.options).toHaveBeenCalledTimes(3);
        expect(appMock.get.mock.calls[0][0]).toBe("/v1/user/get");
        expect(appMock.get.mock.calls[1][0]).toBe("/v1/user/universal");
        expect(appMock.post.mock.calls[0][0]).toBe("/v1/user/set");
        expect(appMock.post.mock.calls[1][0]).toBe("/v1/user/universal");
        expect(appMock.options.mock.calls[0][0]).toBe("/v1/user/get");
        expect(appMock.options.mock.calls[1][0]).toBe("/v1/user/set");
        expect(appMock.options.mock.calls[2][0]).toBe("/v1/user/universal");
        if (wrongMethodBehavior !== 405) return;
        expect(appMock.all).toHaveBeenCalledTimes(3);
        expect(appMock.all.mock.calls[0][0]).toBe("/v1/user/get");
        expect(appMock.all.mock.calls[1][0]).toBe("/v1/user/set");
        expect(appMock.all.mock.calls[2][0]).toBe("/v1/user/universal");
      },
    );

    test("Should accept serveStatic", () => {
      const routing: Routing = {
        public: new ServeStatic(__dirname, { dotfiles: "deny" }),
      };
      const configMock = {
        cors: true,
        startupLogo: false,
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(staticMock).toHaveBeenCalledWith(__dirname, { dotfiles: "deny" });
      expect(appMock.use).toHaveBeenCalledTimes(1);
      expect(appMock.use).toHaveBeenCalledWith("/public", staticHandler);
    });

    test("Should accept DependsOnMethod", () => {
      const handlerMock = vi.fn();
      const configMock = {
        cors: true,
        startupLogo: false,
      };
      const factory = new EndpointsFactory(defaultResultHandler);
      const getEndpoint = factory.build({
        output: z.object({}),
        handler: handlerMock,
      });
      const postEndpoint = factory.build({
        output: z.object({}),
        handler: handlerMock,
      });
      const putAndPatchEndpoint = factory.build({
        output: z.object({}),
        handler: handlerMock,
      });
      const routing: Routing = {
        v1: {
          user: new DependsOnMethod({
            get: getEndpoint,
            post: postEndpoint,
            put: putAndPatchEndpoint,
            patch: putAndPatchEndpoint,
          }),
        },
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.post).toHaveBeenCalledTimes(1);
      expect(appMock.put).toHaveBeenCalledTimes(1);
      expect(appMock.patch).toHaveBeenCalledTimes(1);
      expect(appMock.delete).toHaveBeenCalledTimes(0);
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/user");
      expect(appMock.post.mock.calls[0][0]).toBe("/v1/user");
      expect(appMock.put.mock.calls[0][0]).toBe("/v1/user");
      expect(appMock.patch.mock.calls[0][0]).toBe("/v1/user");
      expect(appMock.options.mock.calls[0][0]).toBe("/v1/user");
    });

    test("Should check if endpoint supports the method it's assigned to within DependsOnMethod", () => {
      const configMock = { cors: true, startupLogo: false };
      const factory = new EndpointsFactory(defaultResultHandler);
      const putAndPatchEndpoint = factory.build({
        method: ["put", "patch"],
        output: z.object({}),
        handler: vi.fn(),
      });
      const routing: Routing = {
        v1: {
          user: new DependsOnMethod({
            put: putAndPatchEndpoint,
            patch: putAndPatchEndpoint,
            post: putAndPatchEndpoint, // intentional
          }),
        },
      };
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: configMock as CommonConfig,
          routing,
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Issue 705: should set all DependsOnMethod' methods for CORS", async () => {
      const handler = vi.fn(async () => ({}));
      const configMock = {
        cors: (params: { defaultHeaders: Record<string, string> }) => ({
          ...params.defaultHeaders,
          "X-Custom-Header": "Testing",
        }),
        startupLogo: false,
      };
      const factory = new EndpointsFactory(defaultResultHandler);
      const input = z.object({});
      const output = z.object({});
      const getEndpoint = factory.build({
        input,
        output,
        handler,
      });
      const postEndpoint = factory.build({
        input,
        output,
        handler,
      });
      const putAndPatchEndpoint = factory.build({
        input,
        output,
        handler,
      });
      const routing: Routing = {
        hello: new DependsOnMethod({
          get: getEndpoint,
          post: postEndpoint,
          put: putAndPatchEndpoint,
          patch: putAndPatchEndpoint,
        }),
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.options).toHaveBeenCalledTimes(1);
      expect(appMock.options.mock.calls[0][0]).toBe("/hello");
      const fn = appMock.options.mock.calls[0][1];
      expect(typeof fn).toBe("function"); // async (req, res) => void
      const requestMock = makeRequestMock({ method: "PUT" });
      const responseMock = makeResponseMock();
      await fn(requestMock, responseMock);
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getHeaders()).toEqual({
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "GET, POST, PUT, PATCH, OPTIONS",
        "access-control-allow-headers": "content-type",
        "content-type": "application/json",
        "x-custom-header": "Testing",
      });
    });

    test("Should accept parameters", () => {
      const handlerMock = vi.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: handlerMock,
      });
      const routing: Routing = {
        v1: {
          user: {
            ":id": endpointMock,
          },
        },
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(1);
      expect(appMock.get.mock.calls[0][0]).toBe("/v1/user/:id");
    });

    test("Should handle empty paths and trim spaces", () => {
      const handlerMock = vi.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: handlerMock,
      });
      const routing: Routing = {
        v1: {
          user: {
            ":id": endpointMock.nest({
              " download ": endpointMock,
            }),
          },
        },
      };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.get).toHaveBeenCalledTimes(2);
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/user/:id",
        expect.any(Function),
      );
      expect(appMock.get).toHaveBeenCalledWith(
        "/v1/user/:id/download",
        expect.any(Function),
      );
    });

    test("Should throw an error in case of slashes in route", () => {
      const handlerMock = vi.fn();
      const configMock = { startupLogo: false };
      const endpointMock = new EndpointsFactory(defaultResultHandler).build({
        output: z.object({}),
        handler: handlerMock,
      });
      const logger = makeLoggerMock();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: configMock as CommonConfig,
          routing: {
            v1: {
              "user/retrieve": endpointMock,
            },
          },
        }),
      ).toThrowErrorMatchingSnapshot();
      expect(() =>
        initRouting({
          app: appMock as unknown as IRouter,
          getLogger: () => logger,
          config: configMock as CommonConfig,
          routing: {
            "v1/user/retrieve": endpointMock,
          },
        }),
      ).toThrowErrorMatchingSnapshot();
    });

    test("Should execute endpoints with right arguments", async () => {
      const handlerMock = vi
        .fn()
        .mockImplementationOnce(() => ({ result: true }));
      const configMock = { cors: true, startupLogo: false };
      const setEndpoint = new EndpointsFactory(defaultResultHandler).build({
        method: "post",
        input: z.object({ test: z.number() }),
        output: z.object({ result: z.boolean() }),
        handler: handlerMock,
      });
      const routing: Routing = {
        v1: {
          user: {
            set: setEndpoint,
          },
        },
      };
      const getLoggerMock = vi.fn(() => makeLoggerMock());
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: getLoggerMock,
        config: configMock as CommonConfig,
        routing,
      });
      expect(appMock.post).toHaveBeenCalledTimes(1);
      const routeHandler = appMock.post.mock.calls[0][1] as RequestHandler;
      const requestMock = makeRequestMock({
        method: "POST",
        body: { test: 123 },
      });
      const responseMock = makeResponseMock();
      const nextMock = vi.fn();
      await routeHandler(requestMock, responseMock, nextMock);
      expect(getLoggerMock).toHaveBeenCalledWith(requestMock);
      expect(nextMock).toHaveBeenCalledTimes(0);
      expect(handlerMock).toHaveBeenCalledTimes(1);
      expect(
        getLoggerMock.mock.results.pop()!.value._getLogs().error,
      ).toHaveLength(0);
      expect(handlerMock).toHaveBeenCalledWith({
        input: { test: 123 },
        options: {},
        logger: getLoggerMock.mock.results.pop()!.value,
      });
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getJSONData()).toEqual({
        status: "success",
        data: { result: true },
      });
    });

    test.each([
      [z.bigint(), z.set(z.string())],
      [z.nan(), z.map(z.string(), z.boolean())],
      [z.date().pipe(z.string()), z.symbol().catch(Symbol("test"))],
      [z.function().transform(() => "test"), z.tuple([z.function()])],
      [ez.dateOut(), ez.dateIn()],
      [z.lazy(() => z.void()), ez.raw()],
      [z.promise(z.any()), ez.upload()],
      [z.never(), z.tuple([ez.file()]).rest(z.nan())],
    ])("should warn about JSON incompatible schemas %#", (input, output) => {
      const endpoint = new EndpointsFactory(defaultResultHandler).build({
        input: z.object({ input }),
        output: z.object({ output }),
        handler: vi.fn(),
      });
      const configMock = { cors: false, startupLogo: false };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing: { path: endpoint },
      });
      expect(logger._getLogs().warn).toEqual([
        [
          "The final input schema of the endpoint contains an unsupported JSON payload type.",
          { method: "get", path: "/path", reason: expect.any(Error) },
        ],
        [
          "The final positive response schema of the endpoint contains an unsupported JSON payload type.",
          { method: "get", path: "/path", reason: expect.any(Error) },
        ],
      ]);
    });

    test("should warn about unused path params", () => {
      const endpoint = new EndpointsFactory(defaultResultHandler).build({
        input: z.object({ id: z.string() }),
        output: z.object({}),
        handler: vi.fn(),
      });
      const configMock = { cors: false, startupLogo: false };
      const logger = makeLoggerMock();
      initRouting({
        app: appMock as unknown as IRouter,
        getLogger: () => logger,
        config: configMock as CommonConfig,
        routing: { v1: { ":idx": endpoint } },
      });
      expect(logger._getLogs().warn).toEqual([
        [
          "The input schema of the endpoint is most likely missing the parameter of the path it's assigned to.",
          { method: "get", param: "idx", path: "/v1/:idx" },
        ],
      ]);
    });
  });

  describe("createWrongMethodHandler", () => {
    test("should call forward 405 error with a header having list of allowed methods", () => {
      const handler = createWrongMethodHandler(["post", "options"]);
      const nextMock = vi.fn();
      const resMock = makeResponseMock();
      handler(makeRequestMock(), resMock, nextMock);
      expect(resMock._getHeaders()).toHaveProperty("allow", "POST, OPTIONS");
      expect(nextMock).toHaveBeenCalledWith(
        createHttpError(405, "GET is not allowed", {
          headers: { Allow: "POST, OPTIONS" },
        }),
      );
    });
  });
});
