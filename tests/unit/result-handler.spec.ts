import { Request, Response } from "express";
import createHttpError from "http-errors";
import { expectType } from "tsd";
import { z } from "zod";
import {
  InputValidationError,
  arrayResultHandler,
  defaultResultHandler,
  ResultHandler,
  AbstractResultHandler,
} from "../../src";
import { ResultHandlerError } from "../../src/errors";
import { metaSymbol } from "../../src/metadata";
import { describe, expect, test, vi } from "vitest";
import { Result } from "../../src/result-handler";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../../src/testing";

describe("ResultHandler", () => {
  describe("conctructor()", () => {
    test("should support multiple response schemas depending on status codes", () => {
      const subject = new ResultHandler({
        positive: () => [
          { statusCode: 200, schema: z.literal("ok") },
          { statusCode: 201, schema: z.literal("kinda") },
        ],
        negative: [
          { statusCode: 400, schema: z.literal("error") },
          { statusCode: 500, schema: z.literal("failure") },
        ],
        handler: ({ response }) => {
          expectType<Response<"ok" | "kinda" | "error" | "failure">>(response);
          response.status(200).send("error");
        },
      });
      expect(subject).toBeInstanceOf(AbstractResultHandler);
    });
  });

  describe("getters", () => {
    test("should throw when result is defined as an empty array", () => {
      expect(() =>
        new ResultHandler({
          positive: () => [] as Result,
          negative: vi.fn(),
          handler: vi.fn(),
        }).getPositiveResponse(z.object({})),
      ).toThrow(
        new ResultHandlerError(
          "At least one positive response schema required.",
        ),
      );
      expect(() =>
        new ResultHandler({
          positive: vi.fn(),
          negative: [] as Result,
          handler: vi.fn(),
        }).getNegativeResponse(),
      ).toThrow(
        new ResultHandlerError(
          "At least one negative response schema required.",
        ),
      );
    });
  });

  const requestMock = makeRequestMock({
    fnMethod: vi.fn,
    requestProps: { method: "POST", url: "http://something/v1/anything" },
  });

  describe.each([
    {
      subject: defaultResultHandler,
      name: "defaultResultHandler",
      errorMethod: "json" as const,
    },
    {
      subject: arrayResultHandler,
      name: "arrayResultHandler",
      errorMethod: "send" as const,
    },
  ])("$name", ({ subject, errorMethod }) => {
    test("Should handle generic error", () => {
      const responseMock = makeResponseMock({ fnMethod: vi.fn });
      const loggerMock = makeLoggerMock({ fnMethod: vi.fn });
      subject.execute({
        error: new Error("Some error"),
        input: { something: 453 },
        output: { anything: 118 },
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        logger: loggerMock,
        options: {},
      });
      expect(loggerMock.error).toHaveBeenCalledTimes(1);
      expect(loggerMock.error.mock.calls[0][0]).toMatch(
        /^Internal server error\nError: Some error/,
      );
      expect(loggerMock.error.mock.calls[0][1]).toHaveProperty("url");
      expect(loggerMock.error.mock.calls[0][1].url).toBe(
        "http://something/v1/anything",
      );
      expect(loggerMock.error.mock.calls[0][1]).toHaveProperty("payload");
      expect(loggerMock.error.mock.calls[0][1].payload).toEqual({
        something: 453,
      });
      expect(responseMock.status).toHaveBeenCalledWith(500);
      expect(responseMock[errorMethod]).toHaveBeenCalledTimes(1);
      expect(responseMock[errorMethod].mock.calls[0]).toMatchSnapshot();
    });

    test("Should handle schema error", () => {
      const responseMock = makeResponseMock({ fnMethod: vi.fn });
      const loggerMock = makeLoggerMock({ fnMethod: vi.fn });
      subject.execute({
        error: new InputValidationError(
          new z.ZodError([
            {
              code: "invalid_type",
              message: "Expected string, got number",
              path: ["something"],
              expected: "string",
              received: "number",
            },
          ]),
        ),
        input: { something: 453 },
        output: { anything: 118 },
        options: {},
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        logger: loggerMock,
      });
      expect(loggerMock.error).toHaveBeenCalledTimes(0);
      expect(responseMock.status).toHaveBeenCalledWith(400);
      expect(responseMock[errorMethod]).toHaveBeenCalledTimes(1);
      expect(responseMock[errorMethod].mock.calls[0]).toMatchSnapshot();
    });

    test("Should handle HTTP error", () => {
      const responseMock = makeResponseMock({ fnMethod: vi.fn });
      const loggerMock = makeLoggerMock({ fnMethod: vi.fn });
      subject.execute({
        error: createHttpError(404, "Something not found"),
        input: { something: 453 },
        output: { anything: 118 },
        options: {},
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        logger: loggerMock,
      });
      expect(loggerMock.error).toHaveBeenCalledTimes(0);
      expect(responseMock.status).toHaveBeenCalledWith(404);
      expect(responseMock[errorMethod]).toHaveBeenCalledTimes(1);
      expect(responseMock[errorMethod].mock.calls[0]).toMatchSnapshot();
    });

    test("Should handle regular response", () => {
      const responseMock = makeResponseMock({ fnMethod: vi.fn });
      const loggerMock = makeLoggerMock({ fnMethod: vi.fn });
      subject.execute({
        error: null,
        input: { something: 453 },
        output: { anything: 118, items: ["One", "Two", "Three"] },
        options: {},
        request: requestMock as unknown as Request,
        response: responseMock as unknown as Response,
        logger: loggerMock,
      });
      expect(loggerMock.error).toHaveBeenCalledTimes(0);
      expect(responseMock.status).toHaveBeenCalledWith(200);
      expect(responseMock.json).toHaveBeenCalledTimes(1);
      expect(responseMock.json.mock.calls[0]).toMatchSnapshot();
    });

    test("should forward output schema examples", () => {
      const apiResponse = subject.getPositiveResponse(
        z
          .object({
            str: z.string(),
            items: z.array(z.string()),
          })
          .example({
            str: "test",
            items: ["One", "Two", "Three"],
          }),
      );
      expect(apiResponse).toHaveLength(1);
      expect(apiResponse[0].schema._def[metaSymbol]).toMatchSnapshot();
    });

    test("should generate negative response example", () => {
      const apiResponse = subject.getNegativeResponse();
      expect(apiResponse).toHaveLength(1);
      expect(apiResponse[0].schema._def[metaSymbol]).toMatchSnapshot();
    });
  });

  test("arrayResultHandler should fail when there is no items prop in the output", () => {
    const responseMock = makeResponseMock({ fnMethod: vi.fn });
    const loggerMock = makeLoggerMock({ fnMethod: vi.fn });
    arrayResultHandler.execute({
      error: null,
      input: { something: 453 },
      output: { anything: 118 },
      options: {},
      request: requestMock as unknown as Request,
      response: responseMock as unknown as Response,
      logger: loggerMock,
    });
    expect(loggerMock.error).toHaveBeenCalledTimes(0);
    expect(responseMock.status).toHaveBeenCalledWith(500);
    expect(responseMock.send).toHaveBeenCalledTimes(1);
    expect(responseMock.send.mock.calls[0]).toMatchSnapshot();
  });
});
