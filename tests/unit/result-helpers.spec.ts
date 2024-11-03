import { range } from "ramda";
import { isServerSideIssue, logServerError } from "../../src/result-helpers";
import { makeLoggerMock, makeRequestMock } from "../../src/testing";

describe("Result helpers", () => {
  describe("isServerSideIssue()", () => {
    test.each(range(100, 599))(
      "should be true when %i >= 500",
      (statusCode) => {
        expect(isServerSideIssue(statusCode)).toBe(statusCode >= 500);
      },
    );
  });

  describe("logServerError()", () => {
    test("should log server side error", () => {
      const error = new Error("test");
      const logger = makeLoggerMock();
      const request = makeRequestMock({ url: "https://example.com" });
      logServerError({
        error,
        logger,
        request,
        statusCode: 501,
        input: { test: 123 },
      });
      expect(logger._getLogs().error).toEqual([
        [
          "Server side error",
          { error, payload: { test: 123 }, url: "https://example.com" },
        ],
      ]);
    });
  });
});
