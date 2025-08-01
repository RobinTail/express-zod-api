import createHttpError from "http-errors";
import {
  combinations,
  defaultInputSources,
  getInput,
  getMessageFromError,
  makeCleanId,
  ensureError,
  getRoutePathParams,
  shouldHaveContent,
  getInputSources,
  emptySchema,
  EmptySchema,
  EmptyObject,
} from "../src/common-helpers";
import { z } from "zod";
import { makeRequestMock } from "../src/testing";
import { methods } from "../src/method";
import { CommonConfig, InputSources } from "../src/config-type";

describe("Common Helpers", () => {
  describe("emptySchema", () => {
    test("should be an object schema with empty shape and strip catcher", () => {
      expect(emptySchema).toMatchSnapshot();
    });
  });

  describe("EmptySchema", () => {
    test("should be the type of emptySchema", () => {
      expectTypeOf<EmptySchema>().toEqualTypeOf(emptySchema);
    });
  });

  describe("EmptyObject", () => {
    test("should be a Record of never", () => {
      expectTypeOf<EmptyObject>().toEqualTypeOf<Record<string, never>>();
    });
  });

  describe("defaultInputSources", () => {
    test("should be declared in a certain way", () => {
      expect(defaultInputSources).toMatchSnapshot();
    });
  });

  describe("getRoutePathParams()", () => {
    test("should return an array of param names", () => {
      expect(getRoutePathParams("/users/:userId/books/:bookId")).toEqual([
        "userId",
        "bookId",
      ]);
      expect(getRoutePathParams("/flights/:from-:to")).toEqual(["from", "to"]);
      expect(getRoutePathParams("/something")).toEqual([]);
      expect(getRoutePathParams("")).toEqual([]);
      expect(getRoutePathParams("\n")).toEqual([]);
    });

    test("should return an array of param names", () => {
      expect(getRoutePathParams("/users/:userId/books/:bookId")).toEqual([
        "userId",
        "bookId",
      ]);
      expect(getRoutePathParams("/flights/:from-:to")).toEqual(["from", "to"]);
      expect(getRoutePathParams("/test/:genus.:species")).toEqual([
        "genus",
        "species",
      ]);
      expect(getRoutePathParams("/something")).toEqual([]);
      expect(getRoutePathParams("")).toEqual([]);
      expect(getRoutePathParams("\n")).toEqual([]);
    });
  });

  describe("getInputSources()", () => {
    test.each([undefined, {}])(
      "should return empty array for options %#",
      (userDefined) => {
        expect(getInputSources("options", userDefined)).toEqual([]);
      },
    );

    test.each(methods)("should return user defined ones for %s", (method) => {
      const userDefined: InputSources = {
        get: ["headers"],
        put: ["files"],
        post: ["query"],
        delete: ["params"],
        patch: ["body"],
      };
      expect(getInputSources(method, userDefined)).toEqual(userDefined[method]);
    });

    test.each([undefined, {}])(
      "should return default ones when missing user defined for %s",
      (userDefined) => {
        expect(getInputSources("get", userDefined)).toEqual(
          defaultInputSources.get,
        );
      },
    );

    test.each<CommonConfig["inputSources"]>([undefined, {}, { get: ["body"] }])(
      "for HEAD should return the same as for GET",
      (userDefined) => {
        expect(getInputSources("head", userDefined)).toEqual(
          getInputSources("get", userDefined),
        );
      },
    );
  });

  describe("getInput()", () => {
    test("should return body for POST, PUT and PATCH requests by default", () => {
      expect(
        getInput(
          makeRequestMock({ body: { param: 123 }, method: "POST" }),
          undefined,
        ),
      ).toEqual({ param: 123 });
      expect(
        getInput(makeRequestMock({ body: { param: 123 }, method: "PUT" }), {}),
      ).toEqual({ param: 123 });
      expect(
        getInput(
          makeRequestMock({ body: { param: 123 }, method: "PATCH" }),
          undefined,
        ),
      ).toEqual({ param: 123 });
    });
    test("should return query for GET requests by default", () => {
      expect(getInput(makeRequestMock({ query: { param: 123 } }), {})).toEqual({
        param: 123,
      });
    });
    test("should return query for HEAD requests by default", () => {
      expect(
        getInput(makeRequestMock({ method: "HEAD", query: { param: 123 } })),
      ).toEqual({
        param: 123,
      });
    });
    test("should return only query for DELETE requests by default", () => {
      expect(
        getInput(
          makeRequestMock({
            query: { a: "query" },
            body: { b: "body" },
            method: "DELETE",
          }),
          undefined,
        ),
      ).toEqual({ a: "query" });
    });
    test("should return body and query for unknown requests by default", () => {
      expect(
        getInput(
          makeRequestMock({
            query: { a: "query" },
            body: { b: "body" },
            method: "UNSUPPORTED" as "GET", // intentional fake
          }),
          undefined,
        ),
      ).toEqual({ a: "query", b: "body" });
    });
    test("should return body and files on demand for POST by default", () => {
      expect(
        getInput(
          makeRequestMock({
            body: { param: 123 },
            files: { file: "456" },
            method: "POST",
            headers: { "content-type": "multipart/form-data; charset=utf-8" },
          }),
          {},
        ),
      ).toEqual({ param: 123, file: "456" });
    });
    test("Issue 158: should return query and body for POST on demand", () => {
      expect(
        getInput(
          makeRequestMock({
            body: { a: "body" },
            query: { b: "query" },
            method: "POST",
          }),
          { post: ["query", "body"] },
        ),
      ).toEqual({ a: "body", b: "query" });
    });
    test("URL params: should also be taken, with a higher priority by default", () => {
      expect(
        getInput(
          makeRequestMock({
            body: { a: "body" },
            query: { b: "query" },
            params: { a: "url param", b: "url param" },
            method: "POST",
          }),
          undefined,
        ),
      ).toEqual({ a: "url param", b: "url param" });
    });
    test("Issue 514: should return empty object for OPTIONS", () => {
      expect(
        getInput(makeRequestMock({ method: "OPTIONS" }), undefined),
      ).toEqual({});
    });
    test("Features 1180 and 2337: should include headers when enabled", () => {
      expect(
        getInput(
          makeRequestMock({
            method: "POST",
            body: { a: "body" },
            headers: { authorization: "Bearer ***", "x-request-id": "test" },
          }),
          { post: ["body", "headers"] },
        ),
      ).toEqual({
        a: "body",
        authorization: "Bearer ***",
        "content-type": "application/json",
        "x-request-id": "test",
      });
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
          input: "test",
        },
        {
          code: "invalid_type",
          path: ["user", "name"],
          message: "expected string, got number",
          expected: "string",
          input: 123,
        },
      ]);
      expect(getMessageFromError(error)).toMatchSnapshot();
    });

    test("should handle empty path in ZodIssue", () => {
      const error = new z.ZodError([
        {
          code: "custom",
          path: [],
          message: "Top level refinement issue",
          input: "test",
        },
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

  describe("ensureError()", () => {
    test.each([
      [new Error("error"), "error"],
      [
        new z.ZodError([
          {
            code: "invalid_type",
            expected: "string",
            input: 123,
            path: [],
            message: "invalid type",
          },
        ]),
        "[\n" +
          "  {\n" +
          '    "code": "invalid_type",\n' +
          '    "expected": "string",\n' +
          '    "input": 123,\n' +
          '    "path": [],\n' +
          '    "message": "invalid type"\n' +
          "  }\n" +
          "]",
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
      const result = ensureError(argument);
      expectTypeOf(result).toEqualTypeOf<Error>();
      expect(result).toBeInstanceOf(Error);
      expect(result).toHaveProperty("message");
      expect(typeof result.message).toBe("string");
      expect(result.message).toBe(expected);
    });
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

  describe("doesImplyContent()", () => {
    test.each(methods)("should return true for %s", (method) => {
      expect(shouldHaveContent(method, ["some"])).toBe(true);
    });

    test("should return false for HEAD request", () => {
      expect(shouldHaveContent("head", ["some"])).toBe(false);
    });

    test("should return false for no MIME types", () => {
      expect(shouldHaveContent("get", null)).toBe(false);
    });
  });
});
