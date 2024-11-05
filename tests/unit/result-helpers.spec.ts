import createHttpError from "http-errors";
import { z } from "zod";
import {
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
} from "../../src/result-helpers";
import { makeLoggerMock, makeRequestMock } from "../../src/testing";

describe("Result helpers", () => {
  describe("logServerError()", () => {
    test("should log server side error", () => {
      const error = createHttpError(501, "test");
      const logger = makeLoggerMock();
      const request = makeRequestMock({ url: "https://example.com" });
      logServerError(error, logger, request, { test: 123 });
      expect(logger._getLogs().error).toEqual([
        [
          "Server side error",
          { error, payload: { test: 123 }, url: "https://example.com" },
        ],
      ]);
    });
  });

  describe("ensureHttpError()", () => {
    test.each([
      new Error("basic"),
      createHttpError(404, "Not really found"),
      z.string().safeParse(123).error!,
    ])("should handle %s", (error) => {
      expect(ensureHttpError(error)).toMatchSnapshot();
    });
  });

  describe.each(["development", "production"])(
    "getPublicErrorMessage() in %s mode",
    (mode) => {
      beforeAll(() => {
        vi.stubEnv("TSUP_STATIC", mode);
        vi.stubEnv("NODE_ENV", mode);
      });
      afterAll(() => vi.unstubAllEnvs());

      test("should return actual message for 400", () => {
        expect(
          getPublicErrorMessage(createHttpError(400, "invalid inputs")),
        ).toBe("invalid inputs");
      });

      test("should comply exposition prop", () => {
        expect(
          getPublicErrorMessage(
            createHttpError(400, "invalid inputs", { expose: false }),
          ),
        ).toBe(mode === "production" ? "Bad Request" : "invalid inputs");
        expect(
          getPublicErrorMessage(
            createHttpError(500, "something particual failed", {
              expose: true,
            }),
          ),
        ).toBe("something particual failed");
      });

      test("should return generalized message for 500", () => {
        expect(
          getPublicErrorMessage(
            createHttpError(500, "something particual failed"),
          ),
        ).toBe(
          mode === "production"
            ? "Internal Server Error"
            : "something particual failed",
        );
      });
    },
  );
});
