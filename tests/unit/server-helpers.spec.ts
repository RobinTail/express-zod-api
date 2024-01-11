import {
  createNotFoundHandler,
  createParserFailureHandler,
} from "../../src/server-helpers";
import { describe, expect, test, vi } from "vitest";
import winston from "winston";
import { defaultResultHandler } from "../../src";
import { Request, Response } from "express";
import { omit } from "ramda";
import assert from "node:assert/strict";
import { makeRequestMock, makeResponseMock } from "../../src/testing";
import createHttpError from "http-errors";

describe("Server helpers", () => {
  describe("createParserFailureHandler()", () => {
    test("the handler should call next if there is no error", () => {
      const logger = winston.createLogger({ silent: true });
      const handler = createParserFailureHandler({
        errorHandler: defaultResultHandler,
        logger,
        childLoggerProvider: undefined,
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
      const logger = winston.createLogger({ silent: true });
      const errorHandler = { ...defaultResultHandler, handler: vi.fn() };
      const handler = createParserFailureHandler({
        errorHandler,
        logger,
        childLoggerProvider: ({ logger: original }) => ({
          ...original,
          isChild: true,
        }),
      });
      await handler(
        new SyntaxError("Unexpected end of JSON input"),
        null as unknown as Request,
        null as unknown as Response,
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
      const logger = winston.createLogger({ silent: true });
      const errorHandler = {
        ...defaultResultHandler,
        handler: vi.fn(),
      };
      const handler = createNotFoundHandler({
        errorHandler,
        logger,
        childLoggerProvider: async ({ logger: original }) => ({
          ...original,
          isChild: true,
        }),
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
      expect(
        omit(["logger"], errorHandler.handler.mock.calls[0][0]),
      ).toMatchSnapshot();
    });

    test("should call Last Resort Handler in case of ResultHandler is faulty", () => {
      const logger = winston.createLogger({ silent: true });
      const errorHandler = {
        ...defaultResultHandler,
        handler: vi.fn().mockImplementation(() => assert.fail("I am faulty")),
      };
      const handler = createNotFoundHandler({
        errorHandler,
        logger,
        childLoggerProvider: undefined,
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
});
