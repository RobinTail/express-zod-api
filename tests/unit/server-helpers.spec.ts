import { fileUploadMock } from "../express-mock";
import { metaSymbol } from "../../src/metadata";
import {
  createNotFoundHandler,
  createCatcher,
  createUploadFailueHandler,
  createUploadLogger,
  createUploadParsers,
  moveRaw,
} from "../../src/server-helpers";
import { describe, expect, test, vi } from "vitest";
import { createResultHandler, defaultResultHandler } from "../../src";
import { Request, Response } from "express";
import assert from "node:assert/strict";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../../src/testing";
import createHttpError from "http-errors";

describe("Server helpers", () => {
  describe("createCatcher()", () => {
    test("the handler should call next if there is no error", () => {
      const rootLogger = makeLoggerMock({ fnMethod: vi.fn });
      const handler = createCatcher({
        errorHandler: defaultResultHandler,
        rootLogger,
      });
      const next = vi.fn();
      handler(
        undefined,
        null as unknown as Request,
        null as unknown as Response,
        next,
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("the handler should call error handler with a child logger", async () => {
      const errorHandler = { ...defaultResultHandler, handler: vi.fn() };
      const rootLogger = makeLoggerMock({ fnMethod: vi.fn });
      const handler = createCatcher({
        errorHandler,
        rootLogger,
      });
      await handler(
        new SyntaxError("Unexpected end of JSON input"),
        null as unknown as Request,
        makeResponseMock({
          fnMethod: vi.fn,
          responseProps: {
            locals: {
              [metaSymbol]: { logger: { ...rootLogger, isChild: true } },
            },
          },
        }) as unknown as Response,
        vi.fn<any>(),
      );
      expect(errorHandler.handler).toHaveBeenCalledTimes(1);
      expect(errorHandler.handler.mock.calls[0][0].error).toEqual(
        createHttpError(400, "Unexpected end of JSON input"),
      );
      expect(errorHandler.handler.mock.calls[0][0].logger).toHaveProperty(
        "isChild",
        true,
      );
    });

    test.each([
      new SyntaxError("Unexpected end of JSON input"),
      new Error("Anything"),
      createHttpError(400, "Unexpected end of JSON input"),
      "just a text",
    ])(
      "the handler should call error handler with given error %#",
      async (error) => {
        const errorHandler = createResultHandler({
          getPositiveResponse: vi.fn(),
          getNegativeResponse: vi.fn(),
          handler: vi.fn(),
        });
        const spy = vi.spyOn(errorHandler, "handler");
        const handler = createCatcher({
          errorHandler,
          rootLogger: makeLoggerMock({ fnMethod: vi.fn }),
        });
        await handler(
          error,
          makeRequestMock({ fnMethod: vi.fn }),
          makeResponseMock({ fnMethod: vi.fn }),
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
      const errorHandler = {
        ...defaultResultHandler,
        handler: vi.fn(),
      };
      const rootLogger = makeLoggerMock({ fnMethod: vi.fn });
      const handler = createNotFoundHandler({
        errorHandler,
        rootLogger,
      });
      const next = vi.fn();
      const requestMock = makeRequestMock({
        fnMethod: vi.fn,
        requestProps: {
          method: "POST",
          path: "/v1/test",
          body: { n: 453 },
        },
      });
      const responseMock = makeResponseMock({
        fnMethod: vi.fn,
        responseProps: {
          locals: {
            [metaSymbol]: { logger: { ...rootLogger, isChild: true } },
          },
        } as unknown as Response,
      });
      await handler(
        requestMock as unknown as Request,
        responseMock as unknown as Response,
        next,
      );
      expect(next).toHaveBeenCalledTimes(0);
      expect(errorHandler.handler).toHaveBeenCalledTimes(1);
      expect(errorHandler.handler.mock.calls[0]).toHaveLength(1);
      expect(errorHandler.handler.mock.calls[0][0]).toHaveProperty("logger");
      expect(errorHandler.handler.mock.calls[0][0].logger).toHaveProperty(
        "isChild",
        true,
      );
      expect(errorHandler.handler.mock.calls[0][0].error).toEqual(
        createHttpError(404, "Can not POST /v1/test"),
      );
      expect(errorHandler.handler.mock.calls[0][0].input).toBeNull();
      expect(errorHandler.handler.mock.calls[0][0].output).toBeNull();
      expect(errorHandler.handler.mock.calls[0][0].request).toEqual(
        requestMock,
      );
      expect(errorHandler.handler.mock.calls[0][0].response).toEqual(
        responseMock,
      );
    });

    test("should call Last Resort Handler in case of ResultHandler is faulty", () => {
      const rootLogger = makeLoggerMock({ fnMethod: vi.fn });
      const errorHandler = {
        ...defaultResultHandler,
        handler: vi.fn().mockImplementation(() => assert.fail("I am faulty")),
      };
      const handler = createNotFoundHandler({
        errorHandler,
        rootLogger,
      });
      const next = vi.fn();
      const requestMock = makeRequestMock({
        fnMethod: vi.fn,
        requestProps: {
          method: "POST",
          path: "/v1/test",
          body: { n: 453 },
        },
      });
      const responseMock = makeResponseMock({ fnMethod: vi.fn });
      handler(
        requestMock as unknown as Request,
        responseMock as unknown as Response,
        next,
      );
      expect(next).toHaveBeenCalledTimes(0);
      expect(errorHandler.handler).toHaveBeenCalledTimes(1);
      expect(responseMock.status).toHaveBeenCalledTimes(1);
      expect(responseMock.status.mock.calls[0][0]).toBe(500);
      expect(responseMock.end).toHaveBeenCalledTimes(1);
      expect(responseMock.end.mock.calls[0][0]).toBe(
        "An error occurred while serving the result: I am faulty.\n" +
          "Original error: Can not POST /v1/test.",
      );
    });
  });

  describe("createUploadFailueHandler()", () => {
    const error = new Error("Too heavy");

    test.each([
      { files: { one: { truncated: true } } },
      { files: { one: [{ truncated: false }, { truncated: true }] } },
    ])("should handle truncated files by calling next with error %#", (req) => {
      const handler = createUploadFailueHandler(error);
      const next = vi.fn();
      handler(req as unknown as Request, {} as Response, next);
      expect(next).toHaveBeenCalledWith(error);
    });

    test.each([
      {},
      { files: {} },
      { files: { one: { truncated: false } } },
      { file: { one: [{ truncated: false }] } },
    ])("should call next when all uploads succeeded %#", (req) => {
      const handler = createUploadFailueHandler(error);
      const next = vi.fn();
      handler(req as unknown as Request, {} as Response, next);
      expect(next).toHaveBeenCalledWith();
    });
  });

  describe("createUploadLogger()", () => {
    const rootLogger = makeLoggerMock({ fnMethod: vi.fn });
    const uploadLogger = createUploadLogger(rootLogger);

    test("should debug the messages", () => {
      uploadLogger.log("Express-file-upload: Busboy finished parsing request.");
      expect(rootLogger.debug).toHaveBeenCalledWith(
        "Express-file-upload: Busboy finished parsing request.",
      );
    });
  });

  describe("createUploadParsers()", async () => {
    const rootLogger = makeLoggerMock({ fnMethod: vi.fn });
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
        logger: rootLogger,
      },
      rootLogger,
    });
    const requestMock = makeRequestMock({ fnMethod: vi.fn });
    const responseMock = makeResponseMock({ fnMethod: vi.fn });
    const nextMock = vi.fn();

    test("should return an array of RequestHandler", () => {
      expect(parsers).toEqual([
        expect.any(Function), // uploader with logger
        expect.any(Function), // createUploadFailueHandler()
      ]);
    });

    test("should handle errors thrown by beforeUpload", async () => {
      const error = createHttpError(403, "Not authorized");
      beforeUploadMock.mockImplementationOnce(() => {
        throw error;
      });
      await parsers[0](
        requestMock as unknown as Request,
        responseMock as unknown as Response,
        nextMock,
      );
      expect(nextMock).toHaveBeenCalledWith(error);
    });

    test("should install the uploader with its special logger", async () => {
      const interalMw = vi.fn();
      fileUploadMock.mockImplementationOnce(() => interalMw);
      await parsers[0](
        requestMock as unknown as Request,
        responseMock as unknown as Response,
        nextMock,
      );
      expect(beforeUploadMock).toHaveBeenCalledWith({
        request: requestMock,
        logger: rootLogger,
      });
      expect(fileUploadMock).toHaveBeenCalledTimes(1);
      expect(fileUploadMock).toHaveBeenCalledWith({
        debug: true,
        abortOnLimit: false,
        parseNested: true,
        limits: { fileSize: 1024 },
        logger: { log: expect.any(Function) }, // @see createUploadLogger test
      });
      expect(interalMw).toHaveBeenCalledWith(
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
        fnMethod: vi.fn,
        requestProps: {
          method: "POST",
          body: buffer,
        },
      });
      const nextMock = vi.fn();
      moveRaw(requestMock as unknown as Request, {} as Response, nextMock);
      expect(requestMock.body).toEqual({ raw: buffer });
      expect(nextMock).toHaveBeenCalled();
    });
  });
});
