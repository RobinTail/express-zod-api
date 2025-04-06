import { Response } from "express";
import createHttpError from "http-errors";
import { z } from "zod";
import {
  InputValidationError,
  arrayResultHandler,
  defaultResultHandler,
  ResultHandler,
} from "../src";
import { ResultHandlerError } from "../src/errors";
import { metaSymbol } from "../src/metadata";
import { AbstractResultHandler, Result } from "../src/result-handler";
import {
  makeLoggerMock,
  makeRequestMock,
  makeResponseMock,
} from "../src/testing";

describe("ResultHandler", () => {
  describe("constructor()", () => {
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
          expectTypeOf(response).toEqualTypeOf<
            Response<"ok" | "kinda" | "error" | "failure">
          >();
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
          new Error("At least one positive response schema required."),
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
          new Error("At least one negative response schema required."),
        ),
      );
    });
  });

  const requestMock = makeRequestMock({
    method: "POST",
    url: "http://something/v1/anything",
  });

  describe.each([
    {
      subject: defaultResultHandler,
      name: "defaultResultHandler",
    },
    {
      subject: arrayResultHandler,
      name: "arrayResultHandler",
    },
  ])("$name", ({ subject }) => {
    test("Should handle generic error", () => {
      const responseMock = makeResponseMock();
      const loggerMock = makeLoggerMock();
      const error = new Error("Some error");
      subject.execute({
        error,
        input: { something: 453 },
        output: { anything: 118 },
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
        options: {},
      });
      expect(loggerMock._getLogs().error).toMatchSnapshot();
      expect(responseMock._getStatusCode()).toBe(500);
      expect(responseMock._getHeaders()).toHaveProperty(
        "content-type",
        responseMock._isJSON() ? "application/json" : "text/plain",
      );
      expect(
        responseMock._isJSON()
          ? responseMock._getJSONData()
          : responseMock._getData(),
      ).toMatchSnapshot();
    });

    test("Should handle schema error", () => {
      const responseMock = makeResponseMock();
      const loggerMock = makeLoggerMock();
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
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
      });
      expect(loggerMock._getLogs().error).toHaveLength(0);
      expect(responseMock._getStatusCode()).toBe(400);
      expect(responseMock._getHeaders()).toHaveProperty(
        "content-type",
        responseMock._isJSON() ? "application/json" : "text/plain",
      );
      expect(
        responseMock._isJSON()
          ? responseMock._getJSONData()
          : responseMock._getData(),
      ).toMatchSnapshot();
    });

    test("Should handle HTTP error", () => {
      const responseMock = makeResponseMock();
      const loggerMock = makeLoggerMock();
      subject.execute({
        error: createHttpError(404, "Something not found"),
        input: { something: 453 },
        output: { anything: 118 },
        options: {},
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
      });
      expect(loggerMock._getLogs().error).toHaveLength(0);
      expect(responseMock._getStatusCode()).toBe(404);
      expect(responseMock._getHeaders()).toHaveProperty(
        "content-type",
        responseMock._isJSON() ? "application/json" : "text/plain",
      );
      expect(
        responseMock._isJSON()
          ? responseMock._getJSONData()
          : responseMock._getData(),
      ).toMatchSnapshot();
    });

    test("Should handle regular response", () => {
      const responseMock = makeResponseMock();
      const loggerMock = makeLoggerMock();
      subject.execute({
        error: null,
        input: { something: 453 },
        output: { anything: 118, items: ["One", "Two", "Three"] },
        options: {},
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
      });
      expect(loggerMock._getLogs().error).toHaveLength(0);
      expect(responseMock._getStatusCode()).toBe(200);
      expect(responseMock._getJSONData()).toMatchSnapshot();
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
    const responseMock = makeResponseMock();
    const loggerMock = makeLoggerMock();
    const positiveSchema = arrayResultHandler
      .getPositiveResponse(
        z.object({ anything: z.number() }).example({ anything: 118 }),
      )
      .pop()?.schema;
    expect(positiveSchema?._def).toHaveProperty("typeName", "ZodArray");
    expect(positiveSchema).toHaveProperty(
      ["element", "_def", "typeName"],
      "ZodAny",
    );
    expect(() =>
      arrayResultHandler.execute({
        error: null,
        input: { something: 453 },
        output: { anything: 118 },
        options: {},
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
      }),
    ).toThrowError(
      // delegated to LastResortHandler, having same format
      new Error("Property 'items' is missing in the endpoint output"),
    );
  });
});
