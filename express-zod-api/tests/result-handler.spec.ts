import type { Response } from "express";
import createHttpError, { HttpError } from "http-errors";
import { z } from "zod";
import {
  InputValidationError,
  arrayResultHandler,
  defaultResultHandler,
  ResultHandler,
} from "../src";
import { ResultHandlerError } from "../src/errors";
import { AbstractResultHandler, type Result } from "../src/result-handler";
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
    test("Should handle generic error", async () => {
      const responseMock = makeResponseMock();
      const loggerMock = makeLoggerMock();
      const error = new Error("Some error");
      await subject.execute({
        error,
        input: { something: 453 },
        output: null,
        request: requestMock,
        response: responseMock,
        logger: loggerMock,
        ctx: {},
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

    test("Should handle schema error", async () => {
      const responseMock = makeResponseMock();
      const loggerMock = makeLoggerMock();
      await subject.execute({
        error: new InputValidationError(
          new z.ZodError([
            {
              code: "invalid_type",
              message: "Expected string, got number",
              path: ["something"],
              expected: "string",
              input: 453,
            },
          ]),
        ),
        input: { something: 453 },
        output: null,
        ctx: {},
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

    test("Should handle HTTP error", async () => {
      const responseMock = makeResponseMock();
      const loggerMock = makeLoggerMock();
      await subject.execute({
        error: createHttpError(404, "Something not found"),
        input: { something: 453 },
        output: null,
        ctx: {},
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

    test("Should handle regular response", async () => {
      const responseMock = makeResponseMock();
      const loggerMock = makeLoggerMock();
      await subject.execute({
        error: null,
        input: { something: 453 },
        output: { anything: 118, items: ["One", "Two", "Three"] },
        ctx: {},
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
        z.object({ str: z.string(), items: z.array(z.string()) }).meta({
          examples: [{ str: "test", items: ["One", "Two", "Three"] }],
        }),
      );
      expect(apiResponse).toHaveLength(1);
      expect(apiResponse[0]!.schema.meta()).toMatchSnapshot();
    });

    test("should generate negative response example", () => {
      const apiResponse = subject.getNegativeResponse();
      expect(apiResponse).toHaveLength(1);
      expect(apiResponse[0]!.schema.meta()).toMatchSnapshot();
    });
  });

  test("arrayResultHandler should attempt to take examples from the items prop", () => {
    const apiResponse = arrayResultHandler.getPositiveResponse(
      z.object({
        items: z
          .array(z.string())
          .meta({ examples: [["One", "Two", "Three"]] }),
      }),
    );
    expect(apiResponse).toHaveLength(1);
    expect(apiResponse[0]!.schema.meta()).toMatchSnapshot();
  });

  test("arrayResultHandler should fail when there is no items prop in the output", async () => {
    const responseMock = makeResponseMock();
    const loggerMock = makeLoggerMock();
    const positiveSchema = arrayResultHandler
      .getPositiveResponse(
        z
          .object({ anything: z.number() })
          .meta({ examples: [{ anything: 118 }] }),
      )
      .pop()?.schema;
    expect(positiveSchema).toHaveProperty(["_zod", "def", "type"], "array");
    expect(positiveSchema).toHaveProperty(
      ["_zod", "def", "element", "_zod", "def", "type"],
      "any",
    );
    await arrayResultHandler.execute({
      error: null,
      input: { something: 453 },
      output: { anything: 118 },
      ctx: {},
      request: requestMock,
      response: responseMock,
      logger: loggerMock,
    });
    expect(responseMock._getStatusCode()).toBe(500);
    expect(responseMock._getHeaders()).toHaveProperty(
      "content-type",
      "text/plain",
    );
  });

  describe("AbstractResultHandler.lastResort", () => {
    test("should be a function", () => {
      expect(typeof AbstractResultHandler.lastResort).toBe("function");
    });

    describe.each(["development", "production"])("%s mode", (mode) => {
      beforeAll(() => {
        vi.stubEnv("TSDOWN_STATIC", mode);
        vi.stubEnv("NODE_ENV", mode);
      });
      afterAll(() => vi.unstubAllEnvs());

      test.each([
        new Error("something went wrong"),
        createHttpError("something went wrong", { expose: true }),
      ])(
        "should log the supplied error and respond with plain text %#",
        (cause) => {
          const responseMock = makeResponseMock();
          const loggerMock = makeLoggerMock();
          const error = new ResultHandlerError(
            cause,
            new Error("what went wrong before"),
          );
          AbstractResultHandler.lastResort({
            error,
            logger: loggerMock,
            response: responseMock,
          });
          expect(loggerMock._getLogs().error).toEqual([
            ["Result handler failure", error],
          ]);
          expect(responseMock._getStatusCode()).toBe(500);
          expect(responseMock._getHeaders()).toHaveProperty(
            "content-type",
            "text/plain",
          );
          expect(responseMock._getData()).toBe(
            mode === "development" ||
              (cause instanceof HttpError && cause.expose)
              ? "An error occurred while serving the result: something went wrong.\nOriginal error: what went wrong before."
              : "Internal Server Error",
          );
        },
      );
    });
  });
});
