import createHttpError from "http-errors";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  InputValidationError,
  getMessageFromError,
  getStatusCodeFromError,
} from "../../src";

describe("Error helpers", () => {
  describe("getStatusCodeFromError()", () => {
    test("should get status code from HttpError", () => {
      expect(
        getStatusCodeFromError(createHttpError(403, "Access denied")),
      ).toEqual(403);
    });

    test("should return 400 for InputValidationError", () => {
      const error = new InputValidationError(
        new z.ZodError([
          {
            code: "invalid_type",
            path: ["user", "id"],
            message: "expected number, got string",
            expected: "number",
            received: "string",
          },
        ]),
      );
      expect(getStatusCodeFromError(error)).toEqual(400);
    });

    test.each([
      new Error("something went wrong"),
      new z.ZodError([
        {
          code: "invalid_type",
          path: ["user", "id"],
          message: "expected number, got string",
          expected: "number",
          received: "string",
        },
      ]),
    ])("should return 500 for other errors %#", (error) => {
      expect(getStatusCodeFromError(error)).toEqual(500);
    });
  });

  describe("getMessageFromError()", () => {
    test("should compile a string from ZodError", () => {
      const error = new z.ZodError([
        {
          code: "invalid_type",
          path: ["user", "id"],
          message: "expected number, got string",
          expected: "number",
          received: "string",
        },
        {
          code: "invalid_type",
          path: ["user", "name"],
          message: "expected string, got number",
          expected: "string",
          received: "number",
        },
      ]);
      expect(getMessageFromError(error)).toMatchSnapshot();
    });

    test("should handle empty path in ZodIssue", () => {
      const error = new z.ZodError([
        { code: "custom", path: [], message: "Top level refinement issue" },
      ]);
      expect(getMessageFromError(error)).toMatchSnapshot();
    });

    test("should pass message from other error types", () => {
      expect(
        getMessageFromError(createHttpError(502, "something went wrong")),
      ).toMatchSnapshot();
      expect(
        getMessageFromError(new Error("something went wrong")),
      ).toMatchSnapshot();
    });
  });
});
