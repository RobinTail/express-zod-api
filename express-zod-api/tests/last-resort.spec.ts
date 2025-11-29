import createHttpError, { HttpError } from "http-errors";
import { ResultHandlerError } from "../src/errors";
import { lastResortHandler } from "../src/last-resort";
import { makeLoggerMock, makeResponseMock } from "../src/testing";

describe("Last Resort Handler", () => {
  test("should be a function", () => {
    expect(typeof lastResortHandler).toBe("function");
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
        lastResortHandler({ error, logger: loggerMock, res: responseMock });
        expect(loggerMock._getLogs().error).toEqual([
          ["Result handler failure", error],
        ]);
        expect(responseMock._getStatusCode()).toBe(500);
        expect(responseMock._getHeaders()).toHaveProperty(
          "content-type",
          "text/plain",
        );
        expect(responseMock._getData()).toBe(
          mode === "development" || (cause instanceof HttpError && cause.expose)
            ? "An error occurred while serving the result: something went wrong.\nOriginal error: what went wrong before."
            : "Internal Server Error",
        );
      },
    );
  });
});
