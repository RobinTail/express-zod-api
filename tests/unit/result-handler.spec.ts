import { Request, Response } from "express";
import createHttpError from "http-errors";
import { expectType } from "tsd";
import { z } from "zod";
import {
  InputValidationError,
  arrayResultHandler,
  createResultHandler,
  defaultResultHandler,
} from "../../src";
import { ApiResponse } from "../../src";
import { metaSymbol } from "../../src/metadata";
import { describe, expect, test, vi } from "vitest";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../../src/testing";

describe("ResultHandler", () => {
  const requestMock = makeRequestMock({
    fnMethod: vi.fn,
    requestProps: { method: "POST", url: "http://something/v1/anything" },
  });

  describe.each([
    {
      resultHandler: defaultResultHandler,
      name: "defaultResultHandler",
      errorMethod: "json",
    },
    {
      resultHandler: arrayResultHandler,
      name: "arrayResultHandler",
      errorMethod: "send",
    },
  ])(
    "$name",
    ({
      resultHandler: { handler, getPositiveResponse, getNegativeResponse },
      errorMethod,
    }) => {
      test("Should handle generic error", () => {
        const responseMock = makeResponseMock({ fnMethod: vi.fn });
        const loggerMock = makeLoggerMock({ fnMethod: vi.fn });
        handler({
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
        handler({
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
        handler({
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
        handler({
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
        const apiResponse = getPositiveResponse(
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
        if (!(apiResponse instanceof z.ZodType)) {
          expect.fail("should not be here");
        }
        expect(apiResponse._def[metaSymbol]).toMatchSnapshot();
      });

      test("should generate negative response example", () => {
        const apiResponse = getNegativeResponse();
        if (!(apiResponse instanceof z.ZodType)) {
          expect.fail("should not be here");
        }
        expect(apiResponse._def[metaSymbol]).toMatchSnapshot();
      });
    },
  );

  test("arrayResultHandler should fail when there is no items prop in the output", () => {
    const responseMock = makeResponseMock({ fnMethod: vi.fn });
    const loggerMock = makeLoggerMock({ fnMethod: vi.fn });
    arrayResultHandler.handler({
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

  test("createResultHandler() should support multiple response schemas depending on status codes", () => {
    const subject = createResultHandler({
      getPositiveResponse: () => [
        { statusCode: 200, schema: z.literal("ok") },
        { statusCode: 201, schema: z.literal("kinda") },
      ],
      getNegativeResponse: () => [
        { statusCode: 400, schema: z.literal("error") },
        { statusCode: 500, schema: z.literal("failure") },
      ],
      handler: ({ response }) => {
        response.status(200).send("error");
      },
    });
    expectType<
      Array<
        ApiResponse<z.ZodLiteral<"ok">> | ApiResponse<z.ZodLiteral<"kinda">>
      >
    >(subject.getPositiveResponse(z.object({})));
    expectType<
      Array<
        | ApiResponse<z.ZodLiteral<"error">>
        | ApiResponse<z.ZodLiteral<"failure">>
      >
    >(subject.getNegativeResponse());
  });
});
