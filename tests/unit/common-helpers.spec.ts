import createHttpError from "http-errors";
import { expectType } from "tsd";
import {
  combinations,
  defaultInputSources,
  getCustomHeaders,
  getInput,
  hasCoercion,
  isCustomHeader,
  makeCleanId,
  makeErrorFromAnything,
} from "../../src/common-helpers";
import { Request } from "express";
import { z } from "zod";
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
          authorization: "Bearer ***",
          "x-request-id": "test",
          "x-another": "header",
        }),
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
