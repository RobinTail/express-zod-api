import "../src/zod-plugin"; // required for this test
import createHttpError from "http-errors";
import {
  combinations,
  defaultInputSources,
  getExamples,
  getInput,
  getMessageFromError,
  hasCoercion,
  makeCleanId,
  ensureError,
  pullExampleProps,
} from "../src/common-helpers";
import { z } from "zod";
import { makeRequestMock } from "../src/testing";

describe("Common Helpers", () => {
  describe("defaultInputSources", () => {
    test("should be declared in a certain way", () => {
      expect(defaultInputSources).toMatchSnapshot();
    });
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

  describe("pullExampleProps()", () => {
    test("handles multiple examples per property", () => {
      const schema = z.object({
        a: z.string().example("one").example("two").example("three"),
        b: z.number().example(1).example(2),
        c: z.boolean().example(false),
      });
      expect(pullExampleProps(schema)).toEqual([
        { a: "one", b: 1, c: false },
        { a: "one", b: 2, c: false },
        { a: "two", b: 1, c: false },
        { a: "two", b: 2, c: false },
        { a: "three", b: 1, c: false },
        { a: "three", b: 2, c: false },
      ]);
    });
  });

  describe("getExamples()", () => {
    test("should return an empty array in case examples are not set", () => {
      expect(getExamples({ schema: z.string(), variant: "parsed" })).toEqual(
        [],
      );
      expect(getExamples({ schema: z.string() })).toEqual([]);
      expect(getExamples({ schema: z.string(), variant: "parsed" })).toEqual(
        [],
      );
      expect(getExamples({ schema: z.string() })).toEqual([]);
    });
    test("should return original examples by default", () => {
      expect(
        getExamples({
          schema: z.string().example("some").example("another"),
        }),
      ).toEqual(["some", "another"]);
    });
    test("should return parsed examples on demand", () => {
      expect(
        getExamples({
          schema: z
            .string()
            .transform((v) => parseInt(v, 10))
            .example("123")
            .example("456"),
          variant: "parsed",
        }),
      ).toEqual([123, 456]);
    });
    test("should not filter out invalid examples by default", () => {
      expect(
        getExamples({
          schema: z
            .string()
            .example("some")
            .example(123 as unknown as string)
            .example("another"),
        }),
      ).toEqual(["some", 123, "another"]);
    });
    test("should filter out invalid examples on demand", () => {
      expect(
        getExamples({
          schema: z
            .string()
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
          schema: z
            .string()
            .transform((v) => parseInt(v, 10))
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
            schema: schema.example([1, 2]).example([3, 4]),
          }),
        ).toEqual([
          [1, 2],
          [3, 4],
        ]);
      },
    );

    describe("Feature #2324: pulling examples up from the object props", () => {
      test("opt-in", () => {
        expect(
          getExamples({
            pullProps: true,
            schema: z.object({
              a: z.string().example("one"),
              b: z.number().example(1),
            }),
          }),
        ).toEqual([{ a: "one", b: 1 }]);
      });
      test("only when the object level is empty", () => {
        expect(
          getExamples({
            pullProps: true,
            schema: z
              .object({
                a: z.string().example("one"),
                b: z.number().example(1),
              })
              .example({ a: "two", b: 2 }), // higher priority
          }),
        ).toEqual([{ a: "two", b: 2 }]);
      });
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
      const result = ensureError(argument);
      expectTypeOf(result).toEqualTypeOf<Error>();
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
