import createHttpError from "http-errors";
import { z } from "zod";
import { InputValidationError, OutputValidationError } from "../src";
import {
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
  normalize,
  pullResponseExamples,
} from "../src/result-helpers";
import { makeLoggerMock, makeRequestMock } from "../src/testing";

describe("Result helpers", () => {
  describe("normalize()", () => {
    const schema = z.string();

    test.each([schema, () => schema])(
      "should handle a plain schema %#",
      (subject) => {
        expect(
          normalize(subject, {
            variant: "positive",
            args: [],
            statusCodes: [200],
            mimeTypes: ["text/plain"],
          }),
        ).toEqual([{ schema, statusCodes: [200], mimeTypes: ["text/plain"] }]);
      },
    );

    test.each([{ schema }, () => ({ schema })])(
      "should handle an object %#",
      (subject) => {
        expect(
          normalize(subject, {
            variant: "positive",
            args: [],
            statusCodes: [200],
            mimeTypes: ["text/plain"],
          }),
        ).toEqual([{ schema, statusCodes: [200], mimeTypes: ["text/plain"] }]);
      },
    );

    test.each([[{ schema }], () => [{ schema }]])(
      "should handle an array of objects %#",
      (subject) => {
        expect(
          normalize(subject, {
            variant: "positive",
            args: [],
            statusCodes: [200],
            mimeTypes: ["text/plain"],
          }),
        ).toEqual([{ schema, statusCodes: [200], mimeTypes: ["text/plain"] }]);
      },
    );

    test("should not mutate the subject when it's a function", () => {
      const subject = () => schema;
      normalize(subject, {
        variant: "positive",
        args: [],
        statusCodes: [200],
        mimeTypes: ["text/plain"],
      });
      expect(typeof subject).toBe("function");
    });
  });

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
      new InputValidationError(z.string().safeParse(123).error!),
      new OutputValidationError(z.string().safeParse(123).error!),
    ])("should handle %s", (error) => {
      expect(ensureHttpError(error)).toMatchSnapshot();
    });
  });

  describe("pullResponseExamples()", () => {
    test("handles multiple examples per property", () => {
      const schema = z.object({
        a: z.string().meta({ examples: ["one", "two", "three"] }),
        b: z.number().meta({ examples: [1, 2] }),
        c: z.boolean().meta({ examples: [false] }),
      });
      expect(pullResponseExamples(schema)).toEqual([
        { a: "one", b: 1, c: false },
        { a: "one", b: 2, c: false },
        { a: "two", b: 1, c: false },
        { a: "two", b: 2, c: false },
        { a: "three", b: 1, c: false },
        { a: "three", b: 2, c: false },
      ]);
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
            createHttpError(500, "something particular failed", {
              expose: true,
            }),
          ),
        ).toBe("something particular failed");
      });

      test("should return generalized message for 500", () => {
        expect(
          getPublicErrorMessage(
            createHttpError(500, "something particular failed"),
          ),
        ).toBe(
          mode === "production"
            ? "Internal Server Error"
            : "something particular failed",
        );
      });
    },
  );
});
