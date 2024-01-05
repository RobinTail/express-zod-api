import { UploadedFile } from "express-fileupload";
import createHttpError from "http-errors";
import { expectType } from "tsd";
import {
  combinations,
  defaultInputSources,
  getCustomHeaders,
  getExamples,
  getInput,
  getMessageFromError,
  getStatusCodeFromError,
  hasCoercion,
  hasNestedSchema,
  hasTopLevelTransformingEffect,
  isCustomHeader,
  isProprietary,
  makeCleanId,
  makeErrorFromAnything,
} from "../../src/common-helpers";
import { InputValidationError, ez, withMeta } from "../../src";
import { Request } from "express";
import { z } from "zod";
import { zodUploadKind } from "../../src/upload-schema";
import { describe, expect, test } from "vitest";

describe("Common Helpers", () => {
  describe("defaultInputSources", () => {
    test("should be declared in a certain way", () => {
      expect(defaultInputSources).toMatchSnapshot();
    });
  });

  describe("isCustomHeader()", () => {
    test.each([
      { name: "x-request-id", expected: true },
      { name: "authorization", expected: false },
    ])("should validate those starting with x- %#", ({ name, expected }) => {
      expect(isCustomHeader(name)).toBe(expected);
    });
  });

  describe("getCustomHeaders()", () => {
    test("should reduce the object to the custom headers only", () => {
      expect(
        getCustomHeaders({
          headers: {
            authorization: "Bearer ***",
            "x-request-id": "test",
            "x-another": "header",
          },
        } as unknown as Request),
      ).toEqual({ "x-request-id": "test", "x-another": "header" });
    });
  });

  describe("getInput()", () => {
    test("should return body for POST, PUT and PATCH requests by default", () => {
      expect(
        getInput(
          {
            body: { param: 123 },
            method: "POST",
            header: () => "application/json",
          } as unknown as Request,
          undefined,
        ),
      ).toEqual({ param: 123 });
      expect(
        getInput(
          {
            body: { param: 123 },
            method: "PUT",
          } as Request,
          {},
        ),
      ).toEqual({ param: 123 });
      expect(
        getInput(
          {
            body: { param: 123 },
            method: "PATCH",
          } as Request,
          undefined,
        ),
      ).toEqual({ param: 123 });
    });
    test("should return query for GET requests by default", () => {
      expect(
        getInput(
          {
            query: { param: 123 },
            method: "GET",
          } as unknown as Request,
          {},
        ),
      ).toEqual({ param: 123 });
    });
    test("should return only query for DELETE requests by default", () => {
      expect(
        getInput(
          {
            query: { a: "query" },
            body: { b: "body" },
            method: "DELETE",
          } as unknown as Request,
          undefined,
        ),
      ).toEqual({ a: "query" });
    });
    test("should return body and query for unknown requests by default", () => {
      expect(
        getInput(
          {
            query: { a: "query" },
            body: { b: "body" },
            method: "UNSUPPORTED",
          } as unknown as Request,
          undefined,
        ),
      ).toEqual({ a: "query", b: "body" });
    });
    test("should return body and files on demand for POST by default", () => {
      expect(
        getInput(
          {
            body: { param: 123 },
            files: { file: "456" },
            method: "POST",
            header: () => "multipart/form-data; charset=utf-8",
          } as unknown as Request,
          {},
        ),
      ).toEqual({ param: 123, file: "456" });
    });
    test("Issue 158: should return query and body for POST on demand", () => {
      expect(
        getInput(
          {
            body: { a: "body" },
            query: { b: "query" },
            method: "POST",
            header: () => "application/json",
          } as unknown as Request,
          { post: ["query", "body"] },
        ),
      ).toEqual({ a: "body", b: "query" });
    });
    test("URL params: should also be taken, with a higher priority by default", () => {
      expect(
        getInput(
          {
            body: { a: "body" },
            query: { b: "query" },
            params: { a: "url param", b: "url param" },
            method: "POST",
            header: () => "application/json",
          } as unknown as Request,
          undefined,
        ),
      ).toEqual({ a: "url param", b: "url param" });
    });
    test("Issue 514: should return empty object for OPTIONS", () => {
      expect(
        getInput({ method: "OPTIONS" } as unknown as Request, undefined),
      ).toEqual({});
    });
    test("Feature 1180: should include custom headers when enabled", () => {
      expect(
        getInput(
          {
            method: "POST",
            body: { a: "body" },
            headers: { authorization: "Bearer ***", "x-request-id": "test" },
          } as unknown as Request,
          { post: ["body", "headers"] },
        ),
      ).toEqual({ a: "body", "x-request-id": "test" });
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

  describe("getExamples()", () => {
    test("should return an empty array in case examples are not set", () => {
      expect(getExamples({ schema: z.string(), variant: "parsed" })).toEqual(
        [],
      );
      expect(getExamples({ schema: z.string() })).toEqual([]);
      expect(
        getExamples({ schema: withMeta(z.string()), variant: "parsed" }),
      ).toEqual([]);
      expect(getExamples({ schema: withMeta(z.string()) })).toEqual([]);
    });
    test("should return original examples by default", () => {
      expect(
        getExamples({
          schema: withMeta(z.string()).example("some").example("another"),
        }),
      ).toEqual(["some", "another"]);
    });
    test("should return parsed examples on demand", () => {
      expect(
        getExamples({
          schema: withMeta(z.string().transform((v) => parseInt(v, 10)))
            .example("123")
            .example("456"),
          variant: "parsed",
        }),
      ).toEqual([123, 456]);
    });
    test("should not filter out invalid examples by default", () => {
      expect(
        getExamples({
          schema: withMeta(z.string())
            .example("some")
            .example(123 as unknown as string)
            .example("another"),
        }),
      ).toEqual(["some", 123, "another"]);
    });
    test("should filter out invalid examples on demand", () => {
      expect(
        getExamples({
          schema: withMeta(z.string())
            .example("some")
            .example(123 as unknown as string)
            .example("another"),
          validate: true,
        }),
      ).toEqual(["some", "another"]);
    });
    test("should filter out invalid examples for the parsed variant", () => {
      expect(
        getExamples({
          schema: withMeta(z.string().transform((v) => parseInt(v, 10)))
            .example("123")
            .example(null as unknown as string)
            .example("456"),
          variant: "parsed",
        }),
      ).toEqual([123, 456]);
    });
    test.each([z.array(z.number().int()), z.tuple([z.number(), z.number()])])(
      "Issue #892: should handle examples of arrays and tuples %#",
      (schema) => {
        expect(
          getExamples({
            schema: withMeta(schema).example([1, 2]).example([3, 4]),
          }),
        ).toEqual([
          [1, 2],
          [3, 4],
        ]);
      },
    );
  });

  describe("combinations()", () => {
    test("should run callback on each combination of items from two arrays", () => {
      expect(combinations([1, 2], [4, 5, 6], ([a, b]) => a + b)).toEqual([
        5, 6, 7, 6, 7, 8,
      ]);
    });

    test("should handle one or two arrays are empty", () => {
      expect(combinations([], [4, 5, 6], ([a, b]) => a + b)).toEqual([4, 5, 6]);
      expect(combinations([1, 2, 3], [], ([a, b]) => a + b)).toEqual([1, 2, 3]);
      expect(combinations<number>([], [], ([a, b]) => a + b)).toEqual([]);
    });
  });

  describe("hasTopLevelTransformingEffect()", () => {
    test("should return true for transformation", () => {
      expect(
        hasTopLevelTransformingEffect(z.object({}).transform(() => [])),
      ).toBeTruthy();
    });
    test("should detect transformation in intersection", () => {
      expect(
        hasTopLevelTransformingEffect(
          z.object({}).and(z.object({}).transform(() => [])),
        ),
      ).toBeTruthy();
    });
    test("should detect transformation in union", () => {
      expect(
        hasTopLevelTransformingEffect(
          z.object({}).or(z.object({}).transform(() => [])),
        ),
      ).toBeTruthy();
    });
    test("should return false for object fields using transformations", () => {
      expect(
        hasTopLevelTransformingEffect(
          z.object({ s: z.string().transform(() => 123) }),
        ),
      ).toBeFalsy();
    });
    test("should return false for refinement", () => {
      expect(
        hasTopLevelTransformingEffect(z.object({}).refine(() => true)),
      ).toBeFalsy();
    });
  });

  describe("hasNestedSchema()", () => {
    test("should return true for given argument satisfying condition", () => {
      expect(
        hasNestedSchema({
          subject: ez.upload(),
          condition: (subject) => isProprietary(subject, zodUploadKind),
        }),
      ).toBeTruthy();
    });
    test.each([
      z.object({ test: ez.upload() }),
      ez.upload().or(z.boolean()),
      z.object({ test: z.boolean() }).and(z.object({ test2: ez.upload() })),
      z.optional(ez.upload()),
      ez.upload().nullable(),
      ez.upload().default({} as UploadedFile),
      z.record(ez.upload()),
      ez.upload().refine(() => true),
      z.array(ez.upload()),
    ])("should return true for wrapped needle %#", (subject) => {
      expect(
        hasNestedSchema({
          subject,
          condition: (entry) => isProprietary(entry, zodUploadKind),
        }),
      ).toBeTruthy();
    });
    test.each([
      z.object({}),
      z.any(),
      z.literal("test"),
      z.boolean().and(z.literal(true)),
      z.number().or(z.string()),
    ])("should return false in other cases %#", (subject) => {
      expect(
        hasNestedSchema({
          subject,
          condition: (entry) => isProprietary(entry, zodUploadKind),
        }),
      ).toBeFalsy();
    });
  });

  describe("makeErrorFromAnything()", () => {
    test.each([
      [new Error("error"), "error"],
      [
        new z.ZodError([
          {
            code: "invalid_type",
            expected: "string",
            received: "number",
            path: [""],
            message: "invalid type",
          },
        ]),
        `[\n  {\n    "code": "invalid_type",\n    "expected": "string",\n` +
          `    "received": "number",\n    "path": [\n      ""\n` +
          `    ],\n    "message": "invalid type"\n  }\n]`,
      ],
      [createHttpError(500, "Internal Server Error"), "Internal Server Error"],
      [undefined, "undefined"],
      [null, "null"],
      ["string", "string"],
      [123, "123"],
      [{}, "[object Object]"],
      [{ test: "object" }, "[object Object]"],
      [NaN, "NaN"],
      [0, "0"],
      ["", ""],
      [-1, "-1"],
      [Infinity, "Infinity"],
      [BigInt(123), "123"],
      [Symbol("symbol"), "Symbol(symbol)"],
      [true, "true"],
      [false, "false"],
      [() => {}, "() => {\n      }"],
      [/regexp/is, "/regexp/is"],
      [[1, 2, 3], "1,2,3"],
    ])("should accept %#", (argument, expected) => {
      const result = makeErrorFromAnything(argument);
      expectType<Error>(result);
      expect(result).toBeInstanceOf(Error);
      expect(result).toHaveProperty("message");
      expect(typeof result.message).toBe("string");
      expect(result.message).toBe(expected);
    });
  });

  describe("hasCoercion()", () => {
    test.each([
      { schema: z.string(), coercion: false },
      { schema: z.coerce.string(), coercion: true },
      { schema: z.boolean({ coerce: true }), coercion: true },
      { schema: z.custom(), coercion: false },
    ])(
      "should check the presence and value of coerce prop %#",
      ({ schema, coercion }) => {
        expect(hasCoercion(schema)).toBe(coercion);
      },
    );
  });

  describe("makeCleanId()", () => {
    test.each([
      ["get"],
      ["post", "/", "something"],
      ["delete", "/user", "permanently"],
      ["patch", "/user/affiliated/account"],
      ["put", "/assets/into/:storageIdentifier"],
      ["get", "/flightDetails/:from-:to/:seatID"],
      ["get", "/companys/:companyId/users/:userId"],
    ])(
      "should generate valid identifier from the supplied strings %#",
      (...args) => {
        expect(makeCleanId(...args)).toMatchSnapshot();
      },
    );
  });
});
