import { fileUploadMock } from "../express-mock";
import { metaSymbol } from "../../src/metadata";
import {
  createLoggingMiddleware,
  createNotFoundHandler,
  createParserFailureHandler,
  createUploadFailureHandler,
  createUploadLogger,
  createUploadParsers,
  makeChildLoggerExtractor,
  moveRaw,
  installDeprecationListener,
  installTerminationListener,
} from "../../src/server-helpers";
import { CommonConfig, defaultResultHandler, ResultHandler } from "../../src";
import { Request } from "express";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../../src/testing";
import createHttpError from "http-errors";

describe("Server helpers", () => {
  describe("createParserFailureHandler()", () => {
    test("the handler should call next if there is no error", () => {
      const handler = createParserFailureHandler({
        errorHandler: defaultResultHandler,
        getChildLogger: () => makeLoggerMock(),
      });
      const next = vi.fn();
      handler(undefined, makeRequestMock(), makeResponseMock(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test.each([
      new SyntaxError("Unexpected end of JSON input"),
      new Error("Anything"),
      createHttpError(400, "Unexpected end of JSON input"),
      "just a text",
    ])(
      "the handler should call error handler with given error %#",
      async (error) => {
        const errorHandler = new ResultHandler({
          positive: vi.fn(),
          negative: vi.fn(),
          handler: vi.fn(),
        });
        const spy = vi.spyOn(errorHandler, "execute");
        const handler = createParserFailureHandler({
          errorHandler,
          getChildLogger: () => makeLoggerMock(),
        });
        await handler(
          error,
          makeRequestMock(),
          makeResponseMock(),
          vi.fn<any>(),
        );
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0][0].error).toEqual(
          error instanceof Error ? error : new Error(error),
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
        getChildLogger: () => makeLoggerMock(),
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
        getChildLogger: () => makeLoggerMock(),
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
    const rootLogger = makeLoggerMock();
    const uploadLogger = createUploadLogger(rootLogger);

    test("should debug the messages", () => {
      uploadLogger.log("Express-file-upload: Busboy finished parsing request.");
      expect(rootLogger._getLogs().debug).toEqual([
        ["Express-file-upload: Busboy finished parsing request."],
      ]);
    });
  });

  describe("createUploadParsers()", async () => {
    const loggerMock = makeLoggerMock();
    const beforeUploadMock = vi.fn();
    const parsers = await createUploadParsers({
      config: {
        server: {
          listen: 8090,
          upload: {
            limits: { fileSize: 1024 },
            limitError: new Error("Too heavy"),
            beforeUpload: beforeUploadMock,
          },
        },
        cors: false,
        logger: { level: "silent" },
      },
      getChildLogger: () => loggerMock,
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
    const rootLogger = makeLoggerMock();
    const child = makeLoggerMock({ isChild: true });
    test.each([undefined, () => child, async () => child])(
      "should make RequestHandler writing logger to res.locals %#",
      async (childLoggerProvider) => {
        const config = { childLoggerProvider } as CommonConfig;
        const handler = createLoggingMiddleware({ rootLogger, config });
        expect(typeof handler).toBe("function");
        const nextMock = vi.fn();
        const response = makeResponseMock();
        const request = makeRequestMock({ path: "/test" });
        request.res = response;
        await handler(request, response, nextMock);
        expect(nextMock).toHaveBeenCalled();
        expect(
          (childLoggerProvider ? child : rootLogger)._getLogs().debug.pop(),
        ).toEqual(["GET: /test"]);
        expect(request.res).toHaveProperty("locals", {
          [metaSymbol]: { logger: childLoggerProvider ? child : rootLogger },
        });
      },
    );
  });

  describe("makeChildLoggerExtractor()", () => {
    const rootLogger = makeLoggerMock();
    const getChildLogger = makeChildLoggerExtractor(rootLogger);

    test("should extract child logger from request", () => {
      const request = makeRequestMock({
        res: {
          locals: {
            [metaSymbol]: { logger: makeLoggerMock({ isChild: true }) },
          },
        },
      });
      expect(getChildLogger(request)).toHaveProperty("isChild", true);
    });

    test("should fall back to root", () => {
      const request = makeRequestMock();
      expect(getChildLogger(request)).toEqual(rootLogger);
    });
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
});
