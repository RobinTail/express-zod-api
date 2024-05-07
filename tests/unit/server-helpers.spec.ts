import {
  createNotFoundHandler,
  createParserFailureHandler,
  createUploadFailueHandler,
  createUploadLogger,
  rawMover,
} from "../../src/server-helpers";
import { describe, expect, test, vi } from "vitest";
import { defaultResultHandler } from "../../src";
import { Request, Response } from "express";
import assert from "node:assert/strict";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../../src/testing";
import createHttpError from "http-errors";

describe("Server helpers", () => {
  describe("createParserFailureHandler()", () => {
    test("the handler should call next if there is no error", () => {
      const rootLogger = makeLoggerMock({ fnMethod: vi.fn });
      const handler = createParserFailureHandler({
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
      const handler = createParserFailureHandler({
        errorHandler,
        rootLogger,
      });
      await handler(
        new SyntaxError("Unexpected end of JSON input"),
        null as unknown as Request,
        makeResponseMock({
          fnMethod: vi.fn,
          responseProps: {
            locals: { logger: { ...rootLogger, isChild: true } },
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
          locals: { logger: { ...rootLogger, isChild: true } },
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

  describe("createUploadLogger", () => {
    const rootLogger = makeLoggerMock({ fnMethod: vi.fn });
    const uploadLogger = createUploadLogger(rootLogger);

    test("should debug the messages", () => {
      uploadLogger.log("Express-file-upload: Busboy finished parsing request.");
      expect(rootLogger.debug).toHaveBeenCalledWith(
        "Express-file-upload: Busboy finished parsing request.",
      );
    });
  });

  describe("rawMover", () => {
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
      rawMover(requestMock as unknown as Request, {} as Response, nextMock);
      expect(requestMock.body).toEqual({ raw: buffer });
      expect(nextMock).toHaveBeenCalled();
    });
  });
});
