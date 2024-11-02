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
    const error = new ResultHandlerError("Failure happened", {
      occurred: new Error("something went wrong"),
      processed: new Error("originally handled"),
    });
    lastResortHandler({
      logger: loggerMock,
      response: responseMock,
      error,
    });
    expect(loggerMock._getLogs().error).toEqual([
      ["Result Handler failure", error],
    ]);
    expect(responseMock._getStatusCode()).toBe(500);
    expect(responseMock._getHeaders()).toHaveProperty(
      "content-type",
      "text/plain",
    );
    expect(responseMock._getData()).toBe(
      "An error occurred while serving the result.",
    );
  });
});
