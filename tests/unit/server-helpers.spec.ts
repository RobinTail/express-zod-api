import { fileUploadMock } from "../express-mock";
import { metaSymbol } from "../../src/metadata";
import {
  createNotFoundHandler,
  createParserFailureHandler,
  createUploadFailueHandler,
  createUploadLogger,
  createUploadParsers,
  moveRaw,
} from "../../src/server-helpers";
import { describe, expect, test, vi } from "vitest";
import { defaultResultHandler, ResultHandler } from "../../src";
import { Request } from "express";
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
      const rootLogger = makeLoggerMock();
      const handler = createParserFailureHandler({
        errorHandler: defaultResultHandler,
        rootLogger,
      });
      const next = vi.fn();
      handler(undefined, makeRequestMock(), makeResponseMock(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("the handler should call error handler with a child logger", async () => {
      const errorHandler = new ResultHandler({
        positive: vi.fn(),
        negative: vi.fn(),
        handler: vi.fn(),
      });
      const spy = vi.spyOn(errorHandler, "execute");
      const rootLogger = makeLoggerMock({ isRoot: true });
      const handler = createParserFailureHandler({
        errorHandler,
        rootLogger,
      });
      await handler(
        new SyntaxError("Unexpected end of JSON input"),
        makeRequestMock(),
        makeResponseMock({
          locals: {
            [metaSymbol]: { logger: makeLoggerMock({ isChild: true }) },
          },
        }),
        vi.fn<any>(),
      );
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0].error).toEqual(
        createHttpError(400, "Unexpected end of JSON input"),
      );
      expect(spy.mock.calls[0][0].logger).toHaveProperty("isChild", true);
    });
  });

  describe("createNotFoundHandler()", () => {
    test("the handler should call ResultHandler with 404 error", async () => {
      const errorHandler = new ResultHandler({
        positive: vi.fn(),
        negative: vi.fn(),
        handler: vi.fn(),
      });
      const spy = vi.spyOn(errorHandler, "execute");
      const rootLogger = makeLoggerMock({ isRoot: true });
      const handler = createNotFoundHandler({
        errorHandler,
        rootLogger,
      });
      const next = vi.fn();
      const requestMock = makeRequestMock({
        method: "POST",
        path: "/v1/test",
        body: { n: 453 },
      });
      const responseMock = makeResponseMock({
        locals: {
          [metaSymbol]: { logger: makeLoggerMock({ isChild: true }) },
        },
      });
      await handler(requestMock, responseMock, next);
      expect(next).toHaveBeenCalledTimes(0);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]).toHaveLength(1);
      expect(spy.mock.calls[0][0]).toHaveProperty("logger");
      expect(spy.mock.calls[0][0].logger).toHaveProperty("isChild", true);
      expect(spy.mock.calls[0][0].error).toEqual(
        createHttpError(404, "Can not POST /v1/test"),
      );
      expect(spy.mock.calls[0][0].input).toBeNull();
      expect(spy.mock.calls[0][0].output).toBeNull();
      expect(spy.mock.calls[0][0].request).toEqual(requestMock);
      expect(spy.mock.calls[0][0].response).toEqual(responseMock);
    });

    test("should call Last Resort Handler in case of ResultHandler is faulty", () => {
      const rootLogger = makeLoggerMock();
      const errorHandler = new ResultHandler({
        positive: vi.fn(),
        negative: vi.fn(),
        handler: vi.fn().mockImplementation(() => assert.fail("I am faulty")),
      });
      const spy = vi.spyOn(errorHandler, "execute");
      const handler = createNotFoundHandler({
        errorHandler,
        rootLogger,
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

  describe("createUploadFailueHandler()", () => {
    const error = new Error("Too heavy");

    test.each([
      { files: { one: { truncated: true } } },
      { files: { one: [{ truncated: false }, { truncated: true }] } },
    ])("should handle truncated files by calling next with error %#", (req) => {
      const handler = createUploadFailueHandler(error);
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
      const handler = createUploadFailueHandler(error);
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
    const rootLogger = makeLoggerMock();
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
    const requestMock = makeRequestMock();
    const responseMock = makeResponseMock();
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
      await parsers[0](requestMock, responseMock, nextMock);
      expect(nextMock).toHaveBeenCalledWith(error);
    });

    test("should install the uploader with its special logger", async () => {
      const interalMw = vi.fn();
      fileUploadMock.mockImplementationOnce(() => interalMw);
      await parsers[0](requestMock, responseMock, nextMock);
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
        method: "POST",
        body: buffer,
      });
      const nextMock = vi.fn();
      moveRaw(requestMock, makeResponseMock(), nextMock);
      expect(requestMock.body).toEqual({ raw: buffer });
      expect(nextMock).toHaveBeenCalled();
    });
  });
});
