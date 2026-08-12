import createHttpError from "http-errors";
import { z } from "zod";
import { InputValidationError, OutputValidationError } from "../src";
import { ResultHandlerError } from "../src/errors";
import {
  overrideStatusCodes,
  ensureHttpError,
  getPublicErrorMessage,
  logServerError,
  normalize,
  pullResponseExamples,
} from "../src/result-helpers";
import { makeLoggerMock, makeRequestMock } from "../src/testing";
import { runtime } from "../src/common-helpers";
import type {
  ApiResponse,
  NormalizedResponse,
  ResponseVariant,
} from "../src/api-response";

describe("Result helpers", () => {
  describe("normalize()", () => {
    const schema = z.string();

    test.each([schema, () => schema])(
      "should handle a plain schema %#",
      (subject) => {
        expect(normalize(subject, { variant: "positive", args: [] })).toEqual([
          { schema, statusCodes: [200], mimeTypes: ["application/json"] },
        ]);
      },
    );

    test.each([{ schema }, () => ({ schema })])(
      "should handle an object %#",
      (subject) => {
        expect(normalize(subject, { variant: "positive", args: [] })).toEqual([
          { schema, statusCodes: [200], mimeTypes: ["application/json"] },
        ]);
      },
    );

    test.each([[{ schema }], () => [{ schema }]])(
      "should handle an array of objects %#",
      (subject) => {
        expect(normalize(subject, { variant: "positive", args: [] })).toEqual([
          { schema, statusCodes: [200], mimeTypes: ["application/json"] },
        ]);
      },
    );

    test("should not mutate the subject when it's a function", () => {
      const subject = () => schema;
      normalize(subject, { variant: "positive", args: [] });
      expect(typeof subject).toBe("function");
    });

    test.each<ApiResponse<z.ZodType>[]>([
      [{ schema: z.string() }, { schema: z.number() }], // both fall back to defaults
      [
        { schema: z.string(), statusCode: 200 },
        { schema: z.number(), statusCode: [204, 200] }, // 200 is duplicated explicitly
      ],
    ])(
      "should throw when same status code used by different schemas %#",
      (...subject) => {
        expect(() =>
          normalize(subject, { variant: "positive", args: [] }),
        ).toThrow(
          new ResultHandlerError(
            new Error(
              "The status code 200 is used by multiple response schemas.",
            ),
          ),
        );
      },
    );

    test.each<[number, ResponseVariant]>([
      [200, "negative"],
      [399, "negative"],
      [400, "positive"],
      [599, "positive"],
    ])(
      "should throw when status code %s does not match the %s response variant",
      (statusCode, variant) => {
        expect(() =>
          normalize({ schema: z.string(), statusCode }, { variant, args: [] }),
        ).toThrow(
          new ResultHandlerError(
            new Error(
              `The status code ${statusCode} is not valid for a ${variant} API response.`,
            ),
          ),
        );
      },
    );
  });

  describe("overrideStatusCodes()", () => {
    const schema = z.string();

    test("should override the status codes of a single schema with the declared ones", () => {
      expect(
        overrideStatusCodes(
          [{ schema, statusCodes: [200], mimeTypes: ["text/plain"] }],
          new Set([201]),
          "positive",
        ),
      ).toEqual([{ schema, statusCodes: [201], mimeTypes: ["text/plain"] }]);
    });

    test("should consider only the status codes relevant to the variant", () => {
      const responses: NormalizedResponse[] = [
        { schema, statusCodes: [200], mimeTypes: ["text/plain"] },
      ];
      expect(
        overrideStatusCodes(responses, new Set([200, 400]), "positive"),
      ).toEqual([{ schema, statusCodes: [200], mimeTypes: ["text/plain"] }]);
      expect(
        overrideStatusCodes(responses, new Set([200, 400]), "negative"),
      ).toEqual([{ schema, statusCodes: [400], mimeTypes: ["text/plain"] }]);
    });

    test("should keep the responses when the declared codes do not match the variant", () => {
      const responses: NormalizedResponse[] = [
        { schema, statusCodes: [400], mimeTypes: ["text/plain"] },
      ];
      expect(
        overrideStatusCodes(responses, new Set([201]), "negative"),
      ).toEqual(responses);
    });

    test("should intersect multi-schema responses with the declared codes", () => {
      const first = z.string();
      const second = z.number();
      expect(
        overrideStatusCodes(
          [
            { schema: first, statusCodes: [200], mimeTypes: ["text/plain"] },
            { schema: second, statusCodes: [400], mimeTypes: ["text/plain"] },
          ],
          new Set([200]),
          "positive",
        ),
      ).toEqual([
        { schema: first, statusCodes: [200], mimeTypes: ["text/plain"] },
      ]);
    });

    test("should throw when the declared codes are not covered by the multi-schema responses", () => {
      expect(() =>
        overrideStatusCodes(
          [
            {
              schema: z.string(),
              statusCodes: [200],
              mimeTypes: ["text/plain"],
            },
            {
              schema: z.number(),
              statusCodes: [400],
              mimeTypes: ["text/plain"],
            },
          ],
          new Set([201]),
          "positive",
        ),
      ).toThrow(ResultHandlerError);
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
        vi.stubEnv("NODE_ENV", mode);
        runtime._cache = undefined;
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
