import { Request, Response } from "express";
import { z } from "zod";
import {
  InputValidationError,
  createHttpError,
  defaultResultHandler,
  withMeta,
} from "../../src";
import { metaProp } from "../../src/metadata";

let loggerMock: any;
let responseMock: any;

describe("ResultHandler", () => {
  beforeEach(() => {
    loggerMock = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    responseMock = {
      set: jest.fn().mockImplementation(() => responseMock),
      status: jest.fn().mockImplementation(() => responseMock),
      json: jest.fn().mockImplementation(() => responseMock),
    };
  });

  describe.each([
    { resultHandler: defaultResultHandler, name: "defaultResultHandler" },
  ])(
    "$name",
    ({
      resultHandler: { handler, getPositiveResponse, getNegativeResponse },
    }) => {
      test("Should handle generic error", () => {
        const requestMock = {
          method: "POST",
          url: "http://something/v1/anything",
        };
        handler({
          error: new Error("Some error"),
          input: { something: 453 },
          output: { anything: 118 },
          request: requestMock as Request,
          response: responseMock as Response,
          logger: loggerMock,
        });
        expect(loggerMock.error).toBeCalledTimes(1);
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
        expect(responseMock.status).toBeCalledWith(500);
        expect(responseMock.json).toHaveBeenCalledTimes(1);
        expect(responseMock.json.mock.calls[0]).toMatchSnapshot();
      });

      test("Should handle schema error", () => {
        const requestMock = {
          method: "POST",
          url: "http://something/v1/anything",
        };
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
          request: requestMock as Request,
          response: responseMock as Response,
          logger: loggerMock,
        });
        expect(loggerMock.error).toBeCalledTimes(0);
        expect(responseMock.status).toBeCalledWith(400);
        expect(responseMock.json).toHaveBeenCalledTimes(1);
        expect(responseMock.json.mock.calls[0]).toMatchSnapshot();
      });

      test("Should handle HTTP error", () => {
        const requestMock = {
          method: "POST",
          url: "http://something/v1/anything",
        };
        handler({
          error: createHttpError(404, "Something not found"),
          input: { something: 453 },
          output: { anything: 118 },
          request: requestMock as Request,
          response: responseMock as Response,
          logger: loggerMock,
        });
        expect(loggerMock.error).toBeCalledTimes(0);
        expect(responseMock.status).toBeCalledWith(404);
        expect(responseMock.json).toHaveBeenCalledTimes(1);
        expect(responseMock.json.mock.calls[0]).toMatchSnapshot();
      });

      test("Should handle regular response", () => {
        const requestMock = {
          method: "POST",
          url: "http://something/v1/anything",
        };
        handler({
          error: null,
          input: { something: 453 },
          output: { anything: 118 },
          request: requestMock as Request,
          response: responseMock as Response,
          logger: loggerMock,
        });
        expect(loggerMock.error).toBeCalledTimes(0);
        expect(responseMock.status).toBeCalledWith(200);
        expect(responseMock.json).toHaveBeenCalledTimes(1);
        expect(responseMock.json.mock.calls[0]).toMatchSnapshot();
      });

      test("should forward output schema examples", () => {
        const apiResponse = getPositiveResponse(
          withMeta(
            z.object({
              str: z.string(),
            }),
          ).example({
            str: "test",
          }),
        );
        if (!(apiResponse instanceof z.ZodType)) {
          fail(new Error("should not be here"));
        }
        expect(apiResponse._def[metaProp]).toMatchSnapshot();
      });

      test("should generate negative response example", () => {
        const apiResponse = getNegativeResponse();
        if (!(apiResponse instanceof z.ZodType)) {
          fail(new Error("should not be here"));
        }
        expect(apiResponse._def[metaProp]).toMatchSnapshot();
      });
    },
  );
});
