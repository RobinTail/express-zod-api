import { fileUploadMock } from "./peers-mock";
import { fail } from "node:assert/strict";
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
  localsID,
} from "../src/server-helpers";
import { defaultResultHandler, ResultHandler, type CommonConfig } from "../src";
import type { Request } from "express";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../src/testing";
import createHttpError from "http-errors";
import { AbstractResultHandler } from "../src/result-handler.ts";

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
        const handler = createCatcher({
          errorHandler,
          getLogger: () => makeLoggerMock(),
        });
        await handler(error, makeRequestMock(), makeResponseMock(), vi.fn());
        expect(spy).toHaveBeenCalledTimes(1);
        expect(spy.mock.calls[0]![0].error).toEqual(
          error instanceof Error ? error : new Error(error),
        );
      },
    );

    test.each([() => fail("I am faulty"), () => Promise.reject("I am faulty")])(
      "should call Last Resort Handler in case of errorHandler::handler is faulty %#",
      async (rhImpl) => {
        const errorHandler = new ResultHandler({
          positive: vi.fn(),
          negative: vi.fn(),
          handler: vi.fn().mockImplementation(rhImpl),
        });
        const spy = vi.spyOn(AbstractResultHandler, "lastResort");
        const handler = createCatcher({
          errorHandler,
          getLogger: () => makeLoggerMock(),
        });
        const responseMock = makeResponseMock();
        await handler(
          new Error("boom"),
          makeRequestMock(),
          responseMock,
          vi.fn(),
        );
        expect(spy).toHaveBeenCalledWith({
          error: expect.objectContaining({
            message: "I am faulty",
            cause: expect.objectContaining({
              message: "I am faulty",
            }),
          }),
          logger: expect.any(Object),
          response: responseMock,
        });
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
      expect(spy.mock.calls[0]![0].error).toEqual(
        createHttpError(404, "Can not POST /v1/test"),
      );
      expect(spy.mock.calls[0]![0].input).toBeNull();
      expect(spy.mock.calls[0]![0].output).toBeNull();
      expect(spy.mock.calls[0]![0].request).toEqual(requestMock);
      expect(spy.mock.calls[0]![0].response).toEqual(responseMock);
    });

    test.each([() => fail("I am faulty"), () => Promise.reject("I am faulty")])(
      "should call Last Resort Handler in case of ResultHandler is faulty %#",
      async (rhImpl) => {
        const errorHandler = new ResultHandler({
          positive: vi.fn(),
          negative: vi.fn(),
          handler: vi.fn().mockImplementation(rhImpl),
        });
        const spy = vi.spyOn(AbstractResultHandler, "lastResort");
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
        expect(spy).toHaveBeenCalledWith({
          error: expect.objectContaining({
            message: "I am faulty",
            cause: expect.objectContaining({ message: "I am faulty" }),
            handled: expect.objectContaining({
              message: "Can not POST /v1/test",
            }),
          }),
          logger: expect.any(Object),
          response: responseMock,
        });
      },
    );
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

  describe("createUploadParsers()", () => {
    const loggerMock = makeLoggerMock();
    const beforeUploadMock = vi.fn();
    const parsers = createUploadParsers({
      config: {
        http: { listen: 1234 },
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

    test("should delegate errors thrown by beforeUpload", async () => {
      const error = createHttpError(403, "Not authorized");
      beforeUploadMock.mockRejectedValueOnce(error);
      await expect(() =>
        parsers[0]!(requestMock, responseMock, nextMock),
      ).rejects.toThrowError(error);
      expect(nextMock).not.toHaveBeenCalled();
    });

    test("should install the uploader with its special logger", async () => {
      const internalMw = vi.fn();
      fileUploadMock.mockImplementationOnce(() => internalMw);
      await parsers[0]!(requestMock, responseMock, nextMock);
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
    describe("should make RequestHandler writing logger to res.locals", () => {
      const logger = makeLoggerMock();
      const child = makeLoggerMock({ isChild: true });
      test.each([undefined, () => child, async () => child])(
        "case %#",
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
            [localsID]: { logger: childLoggerProvider ? child : logger },
          });
        },
      );
    });

    test.each<[CommonConfig["accessLogger"], string[][]]>([
      [undefined, [["GET: /test"]]],
      [null, []],
      [({}, instance) => instance.debug("TEST"), [["TEST"]]],
    ])(
      "access logger can be customized and disabled %#",
      async (accessLogger, expected) => {
        const config = { accessLogger } as CommonConfig;
        const logger = makeLoggerMock();
        const handler = createLoggingMiddleware({ logger, config });
        const request = makeRequestMock({ path: "/test" });
        const response = makeResponseMock();
        await handler(request, response, vi.fn());
        expect(logger._getLogs().debug).toEqual(expected);
      },
    );

    test.each(["childLoggerProvider", "accessLogger"] as const)(
      "should delegate errors in %s",
      async (prop) => {
        const config = {
          [prop]: () => fail("Something went wrong"),
        } as unknown as CommonConfig;
        const logger = makeLoggerMock();
        const handler = createLoggingMiddleware({ logger, config });
        const request = makeRequestMock({ path: "/test" });
        const response = makeResponseMock();
        const nextMock = vi.fn();
        await expect(() =>
          handler(request, response, nextMock),
        ).rejects.toThrowErrorMatchingSnapshot();
        expect(nextMock).not.toHaveBeenCalled();
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
            [localsID]: { logger: makeLoggerMock({ isChild: true }) },
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
    test("should assign deprecation event listener on process once", () => {
      const spy = vi.spyOn(process, "on").mockImplementation(vi.fn());
      const logger = makeLoggerMock();
      installDeprecationListener(logger);
      expect(spy).toHaveBeenCalledWith("deprecation", expect.any(Function));
      installDeprecationListener(logger);
      expect(spy).toHaveBeenCalledOnce();
      spy.mockReset();
    });
  });

  describe("installTerminationListener", () => {
    test("should install termination signal listener on process only once per event", () => {
      const listeners: Record<string, any[]> = {};
      const spy = vi
        .spyOn(process, "on")
        .mockImplementation((evt: string, fn: any) => {
          listeners[evt] ??= [];
          listeners[evt].push(fn);
          return process;
        });
      vi.spyOn(process, "listeners").mockImplementation(
        (evt: string) => listeners[evt] ?? [],
      );
      const logger = makeLoggerMock();
      installTerminationListener({
        servers: [],
        logger,
        options: { events: ["NOT_HAPPEN"] },
      });
      expect(spy.mock.calls).toEqual([["NOT_HAPPEN", expect.any(Function)]]);
      installTerminationListener({
        servers: [],
        logger,
        options: { events: ["NOT_HAPPEN", "ANOTHER_ONE", "NOT_HAPPEN"] },
      });
      expect(spy.mock.calls).toEqual([
        ["NOT_HAPPEN", expect.any(Function)],
        ["ANOTHER_ONE", expect.any(Function)],
      ]);
    });
  });
});
