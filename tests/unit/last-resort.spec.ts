import { ResultHandlerError } from "../../src/errors";
import { lastResortHandler } from "../../src/last-resort";
import { makeLoggerMock, makeResponseMock } from "../../src/testing";

describe("Last Resort Handler", () => {
  test("should be a function", () => {
    expect(typeof lastResortHandler).toBe("function");
  });

  test("should log the supplied error and respond with plain text", () => {
    const responseMock = makeResponseMock();
    const loggerMock = makeLoggerMock();
    const error = new ResultHandlerError(
      new Error("something went wrong"),
      new Error("what went wrong before"),
    );
    lastResortHandler({ error, logger: loggerMock, response: responseMock });
    expect(loggerMock._getLogs().error).toEqual([
      ["Result handler failure", error],
    ]);
    expect(responseMock._getStatusCode()).toBe(500);
    expect(responseMock._getHeaders()).toHaveProperty(
      "content-type",
      "text/plain",
    );
    expect(responseMock._getData()).toBe(
      "An error occurred while serving the result: something went wrong.\nOriginal error: what went wrong before.",
    );
  });
});
