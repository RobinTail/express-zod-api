import { ReferenceObject } from "openapi3-ts/oas31";
import { z } from "zod";
import { ez } from "../../src";
import {
  OpenAPIContext,
  depictAny,
  depictArray,
  depictBigInt,
  depictBoolean,
  depictBranded,
  depictCatch,
  depictDate,
  depictDateIn,
  depictDateOut,
  depictDefault,
  depictDiscriminatedUnion,
  depictEffect,
  depictEnum,
  depictExamples,
  depictFile,
  depictIntersection,
  depictLazy,
  depictLiteral,
  depictNull,
  depictNullable,
  depictNumber,
  depictObject,
  depictObjectProperties,
  depictOptional,
  depictParamExamples,
  depictPipeline,
  depictReadonly,
  depictRecord,
  depictRequestParams,
  depictSecurity,
  depictString,
  depictTags,
  depictTuple,
  depictUnion,
  depictUpload,
  depicters,
  ensureShortDescription,
  excludeExamplesFromDepiction,
  excludeParamsFromDepiction,
  extractObjectSchema,
  getRoutePathParams,
  onEach,
  onMissing,
  reformatParamsInPath,
} from "../../src/documentation-helpers";
import { walkSchema } from "../../src/schema-walker";

describe("Documentation helpers", () => {
  const makeRefMock = vi.fn();
  const requestCtx = {
    path: "/v1/user/:id",
    method: "get",
    isResponse: false,
    makeRef: makeRefMock,
    next: (schema: z.ZodTypeAny) =>
      walkSchema(schema, {
        rules: depicters,
        onEach,
        onMissing,
        ctx: requestCtx,
      }),
  } satisfies OpenAPIContext;
  const responseCtx = {
    path: "/v1/user/:id",
    method: "get",
    isResponse: true,
    makeRef: makeRefMock,
    next: (schema: z.ZodTypeAny) =>
      walkSchema(schema, {
        rules: depicters,
        onEach,
        onMissing,
        ctx: responseCtx,
      }),
  } satisfies OpenAPIContext;

  beforeEach(() => {
    makeRefMock.mockClear();
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

  describe("extractObjectSchema()", () => {
    test("should pass the object schema through", () => {
      const subject = extractObjectSchema(z.object({ one: z.string() }));
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(subject).toMatchSnapshot();
    });

    test("should return object schema for the union of object schemas", () => {
      const subject = extractObjectSchema(
        z.object({ one: z.string() }).or(z.object({ two: z.number() })),
      );
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(subject).toMatchSnapshot();
    });

    test("should return object schema for the intersection of object schemas", () => {
      const subject = extractObjectSchema(
        z.object({ one: z.string() }).and(z.object({ two: z.number() })),
      );
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(subject).toMatchSnapshot();
    });

    test("should support ez.raw()", () => {
      const subject = extractObjectSchema(ez.raw());
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(subject).toMatchSnapshot();
    });

    describe("Feature #600: Top level refinements", () => {
      test("should handle refined object schema", () => {
        const subject = extractObjectSchema(
          z.object({ one: z.string() }).refine(() => true),
        );
        expect(subject).toBeInstanceOf(z.ZodObject);
        expect(subject).toMatchSnapshot();
      });
    });

    describe("Feature #1869: Top level transformations", () => {
      test("should handle transformations to another object", () => {
        const subject = extractObjectSchema(
          z.object({ one: z.string() }).transform(({ one }) => ({ two: one })),
        );
        expect(subject).toBeInstanceOf(z.ZodObject);
        expect(subject).toMatchSnapshot();
      });
    });
  });

  describe("excludeParamsFromDepiction()", () => {
    test.each<z.ZodTypeAny>([
      z.object({ a: z.string(), b: z.string() }),
      z.object({ a: z.string() }).or(z.object({ b: z.string() })),
      z.object({ a: z.string() }).and(z.object({ b: z.string() })), // flattened
      z
        .record(z.literal("a"), z.string())
        .and(z.record(z.string(), z.string())),
    ])("should omit specified params %#", (schema) => {
      const depicted = walkSchema(schema, {
        ctx: requestCtx,
        rules: depicters,
        onEach,
        onMissing,
      });
      expect(excludeParamsFromDepiction(depicted, ["a"])).toMatchSnapshot();
    });

    test("should handle the ReferenceObject", () => {
      expect(
        excludeParamsFromDepiction({ $ref: "test" }, ["a"]),
      ).toMatchSnapshot();
    });
  });

  describe("reformatParamsInPath()", () => {
    test("should replace route path params from colon to curly braces notation", () => {
      expect(reformatParamsInPath("/v1/user")).toBe("/v1/user");
      expect(reformatParamsInPath("/v1/user/:id")).toBe("/v1/user/{id}");
      expect(reformatParamsInPath("/v1/flight/:from-:to")).toBe(
        "/v1/flight/{from}-{to}",
      );
      expect(reformatParamsInPath("/v1/flight/:from-:to/updates")).toBe(
        "/v1/flight/{from}-{to}/updates",
      );
    });
  });

  describe("depictDefault()", () => {
    test("should set default property", () => {
      expect(
        depictDefault(z.boolean().default(true), requestCtx),
      ).toMatchSnapshot();
    });
    test("Feature #1706: should override the default value by a label from metadata", () => {
      expect(
        depictDefault(
          z
            .string()
            .datetime()
            .default(() => new Date().toISOString())
            .label("Today"),
          responseCtx,
        ),
      ).toMatchSnapshot();
    });
  });

  describe("depictCatch()", () => {
    test("should pass next depicter", () => {
      expect(
        depictCatch(z.boolean().catch(true), requestCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictAny()", () => {
    test("should set format:any", () => {
      expect(depictAny(z.any(), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictUpload()", () => {
    test("should set format:binary and type:string", () => {
      expect(depictUpload(ez.upload(), requestCtx)).toMatchSnapshot();
    });
    test("should throw when using in response", () => {
      expect(() =>
        depictUpload(ez.upload(), responseCtx),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("depictFile()", () => {
    test.each([
      ez.file(),
      ez.file("binary"),
      ez.file("base64"),
      ez.file("string"),
      ez.file("buffer"),
    ])("should set type:string and format accordingly %#", (schema) => {
      expect(depictFile(schema, responseCtx)).toMatchSnapshot();
    });
  });

  describe("depictUnion()", () => {
    test("should wrap next depicters into oneOf property", () => {
      expect(
        depictUnion(z.string().or(z.number()), requestCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictDiscriminatedUnion()", () => {
    test("should wrap next depicters in oneOf prop and set discriminator prop", () => {
      expect(
        depictDiscriminatedUnion(
          z.discriminatedUnion("status", [
            z.object({ status: z.literal("success"), data: z.any() }),
            z.object({
              status: z.literal("error"),
              error: z.object({ message: z.string() }),
            }),
          ]),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });
  });

  describe("depictIntersection()", () => {
    test("should flatten two object schemas", () => {
      expect(
        depictIntersection(
          z.object({ one: z.number() }).and(z.object({ two: z.number() })),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test("should NOT flatten object schemas having conflicting props", () => {
      expect(
        depictIntersection(
          z.object({ one: z.number() }).and(z.object({ one: z.string() })),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test("should merge examples deeply", () => {
      expect(
        depictIntersection(
          z
            .object({ test: z.object({ a: z.number() }) })
            .example({ test: { a: 123 } })
            .and(
              z
                .object({ test: z.object({ b: z.number() }) })
                .example({ test: { b: 456 } }),
            ),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test("should flatten three object schemas with examples", () => {
      expect(
        depictIntersection(
          z
            .object({ one: z.number() })
            .example({ one: 123 })
            .and(z.object({ two: z.number() }).example({ two: 456 }))
            .and(z.object({ three: z.number() }).example({ three: 789 })),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test("should maintain uniqueness in the array of required props", () => {
      expect(
        depictIntersection(
          z
            .record(z.literal("test"), z.number())
            .and(z.object({ test: z.literal(5) })),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test.each([
      z.record(z.string(), z.number()).and(z.object({ test: z.number() })), // has additionalProperties
      z.number().and(z.literal(5)), // not objects
    ])("should fall back to allOf in other cases %#", (schema) => {
      expect(depictIntersection(schema, requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictOptional()", () => {
    test.each([requestCtx, responseCtx])(
      "should pass the next depicter %#",
      (ctx) => {
        expect(depictOptional(z.string().optional(), ctx)).toMatchSnapshot();
      },
    );
  });

  describe("depictNullable()", () => {
    test.each([requestCtx, responseCtx])(
      "should add null to the type %#",
      (ctx) => {
        expect(depictNullable(z.string().nullable(), ctx)).toMatchSnapshot();
      },
    );

    test.each([z.null().nullable(), z.string().nullable().nullable()])(
      "should not add null type when it's already there %#",
      (schema) => {
        expect(depictNullable(schema, requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictEnum()", () => {
    enum Test {
      one = "ONE",
      two = "TWO",
    }
    test.each([z.enum(["one", "two"]), z.nativeEnum(Test)])(
      "should set type and enum properties",
      (schema) => {
        expect(depictEnum(schema, requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictLiteral()", () => {
    test.each(["testng", null, BigInt(123), Symbol("test")])(
      "should set type and involve const property %#",
      (value) => {
        expect(depictLiteral(z.literal(value), requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictObject()", () => {
    test.each([
      { ctx: requestCtx, shape: { a: z.number(), b: z.string() } },
      { ctx: responseCtx, shape: { a: z.number(), b: z.string() } },
      {
        ctx: responseCtx,
        shape: { a: z.coerce.number(), b: z.string({ coerce: true }) },
      },
      { ctx: responseCtx, shape: { a: z.number(), b: z.string().optional() } },
      {
        ctx: requestCtx,
        shape: { a: z.number().optional(), b: z.coerce.string() },
      },
    ])(
      "should type:object, properties and required props %#",
      ({ shape, ctx }) => {
        expect(depictObject(z.object(shape), ctx)).toMatchSnapshot();
      },
    );

    test("Bug #758", () => {
      const schema = z.object({
        a: z.string(),
        b: z.coerce.string(),
        c: z.coerce.string().optional(),
      });
      expect(depictObject(schema, responseCtx)).toMatchSnapshot();
    });
  });

  describe("depictNull()", () => {
    test("should give type:null", () => {
      expect(depictNull(z.null(), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictBoolean()", () => {
    test("should set type:boolean", () => {
      expect(depictBoolean(z.boolean(), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictBigInt()", () => {
    test("should set type:integer and format:bigint", () => {
      expect(depictBigInt(z.bigint(), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictRecord()", () => {
    test.each([
      z.record(z.boolean()),
      z.record(z.string(), z.boolean()),
      z.record(z.enum(["one", "two"]), z.boolean()),
      z.record(z.literal("testing"), z.boolean()),
      z.record(z.literal("one").or(z.literal("two")), z.boolean()),
      z.record(z.any()), // Issue #900
    ])(
      "should set properties+required or additionalProperties props %#",
      (schema) => {
        expect(depictRecord(schema, requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictArray()", () => {
    test("should set type:array and pass items depiction", () => {
      expect(depictArray(z.array(z.boolean()), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictTuple()", () => {
    test("should utilize prefixItems and set items:not:{}", () => {
      expect(
        depictTuple(
          z.tuple([z.boolean(), z.string(), z.literal("test")]),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });
    test("should depict rest as items when defined", () => {
      expect(
        depictTuple(z.tuple([z.boolean()]).rest(z.string()), requestCtx),
      ).toMatchSnapshot();
    });
    test("should depict empty tuples as is", () => {
      expect(depictTuple(z.tuple([]), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictString()", () => {
    test("should set type:string", () => {
      expect(depictString(z.string(), requestCtx)).toMatchSnapshot();
    });

    test.each([
      z.string().email().min(10).max(20),
      z.string().url().length(15),
      z.string().uuid(),
      z.string().cuid(),
      z.string().datetime(),
      z.string().datetime({ offset: true }),
      z.string().regex(/^\d+.\d+.\d+$/),
      z.string().date(),
      z.string().time(),
      z.string().duration(),
      z.string().cidr(),
      z.string().ip(),
      z.string().jwt(),
      z.string().base64(),
      z.string().base64url(),
      z.string().cuid2(),
      z.string().ulid(),
    ])("should set format, pattern and min/maxLength props %#", (schema) => {
      expect(depictString(schema, requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictNumber()", () => {
    test.each([z.number(), z.number().int().min(10).max(20)])(
      "should type:number, min/max, format and exclusiveness props",
      (schema) => {
        expect(depictNumber(schema, requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictObjectProperties()", () => {
    test("should wrap next depicters in a shape of object", () => {
      expect(
        depictObjectProperties(
          z.object({
            one: z.string(),
            two: z.boolean(),
          }),
          requestCtx.next,
        ),
      ).toMatchSnapshot();
    });
  });

  describe("depictEffect()", () => {
    test.each([
      {
        schema: z.string().transform((v) => parseInt(v, 10)),
        ctx: responseCtx,
        expected: "number (out)",
      },
      {
        schema: z.string().transform((v) => parseInt(v, 10)),
        ctx: requestCtx,
        expected: "string (in)",
      },
      {
        schema: z.preprocess((v) => parseInt(`${v}`, 10), z.string()),
        ctx: requestCtx,
        expected: "string (preprocess)",
      },
      {
        schema: z
          .object({ s: z.string() })
          .refine(() => false, { message: "test" }),
        ctx: requestCtx,
        expected: "object (refinement)",
      },
    ])("should depict as $expected", ({ schema, ctx }) => {
      expect(depictEffect(schema, ctx)).toMatchSnapshot();
    });

    test.each([
      z.number().transform((num) => () => num),
      z.number().transform(() => assert.fail("this should be handled")),
    ])("should handle edge cases", (schema) => {
      expect(depictEffect(schema, responseCtx)).toMatchSnapshot();
    });
  });

  describe("depictPipeline", () => {
    test.each([
      { ctx: responseCtx, expected: "boolean (out)" },
      { ctx: requestCtx, expected: "string (in)" },
    ])("should depict as $expected", ({ ctx }) => {
      expect(
        depictPipeline(z.string().pipe(z.coerce.boolean()), ctx),
      ).toMatchSnapshot();
    });
  });

  describe("depictExamples()", () => {
    test.each<{ isResponse: boolean } & Record<"case" | "action", string>>([
      { isResponse: false, case: "request", action: "pass" },
      { isResponse: true, case: "response", action: "transform" },
    ])("should $action examples in case of $case", ({ isResponse }) => {
      expect(
        depictExamples(
          z
            .object({
              one: z.string().transform((v) => v.length),
              two: z.number().transform((v) => `${v}`),
              three: z.boolean(),
            })
            .example({
              one: "test",
              two: 123,
              three: true,
            })
            .example({
              one: "test2",
              two: 456,
              three: false,
            }),
          isResponse,
          ["three"],
        ),
      ).toMatchSnapshot();
    });
  });

  describe("depictParamExamples()", () => {
    test("should pass examples for the given parameter", () => {
      expect(
        depictParamExamples(
          z
            .object({
              one: z.string().transform((v) => v.length),
              two: z.number().transform((v) => `${v}`),
              three: z.boolean(),
            })
            .example({
              one: "test",
              two: 123,
              three: true,
            })
            .example({
              one: "test2",
              two: 456,
              three: false,
            }),
          "two",
        ),
      ).toMatchSnapshot();
    });
  });

  describe("depictRequestParams()", () => {
    test("should depict query and path params", () => {
      expect(
        depictRequestParams({
          schema: z.object({
            id: z.string(),
            test: z.boolean(),
          }),
          inputSources: ["query", "params"],
          composition: "inline",
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });

    test("should depict only path params if query is disabled", () => {
      expect(
        depictRequestParams({
          schema: z.object({
            id: z.string(),
            test: z.boolean(),
          }),
          inputSources: ["body", "params"],
          composition: "inline",
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });

    test("should depict none if both query and params are disabled", () => {
      expect(
        depictRequestParams({
          schema: z.object({
            id: z.string(),
            test: z.boolean(),
          }),
          inputSources: ["body"],
          composition: "inline",
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });

    test("Feature 1180: should depict header params when enabled", () => {
      expect(
        depictRequestParams({
          schema: z.object({
            "x-request-id": z.string(),
            id: z.string(),
            test: z.boolean(),
          }),
          inputSources: ["query", "headers", "params"],
          composition: "inline",
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });
  });

  describe("excludeExamplesFromDepiction()", () => {
    test("should remove example property of supplied object", () => {
      expect(
        excludeExamplesFromDepiction({
          type: "string",
          description: "test",
          examples: ["test"],
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictDateIn", () => {
    test("should set type:string, pattern and format", () => {
      expect(depictDateIn(ez.dateIn(), requestCtx)).toMatchSnapshot();
    });
    test("should throw when ZodDateIn in response", () => {
      expect(() =>
        depictDateIn(ez.dateIn(), responseCtx),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("depictDateOut", () => {
    test("should set type:string, description and format", () => {
      expect(depictDateOut(ez.dateOut(), responseCtx)).toMatchSnapshot();
    });
    test("should throw when ZodDateOut in request", () => {
      expect(() =>
        depictDateOut(ez.dateOut(), requestCtx),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("depictDate", () => {
    test.each([responseCtx, requestCtx])(
      "should throw clear error %#",
      (ctx) => {
        expect(() => depictDate(z.date(), ctx)).toThrowErrorMatchingSnapshot();
      },
    );
  });

  describe("depictBranded", () => {
    test("should pass the next depicter", () => {
      expect(
        depictBranded(z.string().min(2).brand("Test"), responseCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictReadonly", () => {
    test("should pass the next depicter", () => {
      expect(
        depictReadonly(z.string().readonly(), responseCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictLazy", () => {
    const recursiveArray: z.ZodLazy<z.ZodArray<z.ZodTypeAny>> = z.lazy(() =>
      recursiveArray.array(),
    );
    const directlyRecursive: z.ZodLazy<z.ZodTypeAny> = z.lazy(
      () => directlyRecursive,
    );
    const recursiveObject: z.ZodLazy<z.ZodObject<z.ZodRawShape>> = z.lazy(() =>
      z.object({ prop: recursiveObject }),
    );

    test.each([recursiveArray, directlyRecursive, recursiveObject])(
      "should handle circular references %#",
      (schema) => {
        makeRefMock.mockImplementationOnce(
          (): ReferenceObject => ({
            $ref: "#/components/schemas/SomeSchema",
          }),
        );
        expect(makeRefMock).not.toHaveBeenCalled();
        expect(depictLazy(schema, responseCtx)).toMatchSnapshot();
        expect(makeRefMock).toHaveBeenCalledTimes(1);
        expect(makeRefMock).toHaveBeenCalledWith(schema, expect.any(Function));
      },
    );
  });

  describe("depictSecurity()", () => {
    test("should handle Basic, Bearer and CustomHeader Securities", () => {
      expect(
        depictSecurity([
          {
            or: [
              { and: [{ type: "basic" }, { type: "bearer" }] },
              { type: "header", name: "X-Key" },
            ],
          },
        ]),
      ).toMatchSnapshot();
    });
    test("should handle Input and Cookie Securities", () => {
      expect(
        depictSecurity([
          {
            and: [
              {
                or: [
                  { type: "input", name: "apiKey" },
                  { type: "cookie", name: "hash" },
                ],
              },
            ],
          },
        ]),
      ).toMatchSnapshot();
    });
    test.each([
      { variant: "alternative", inputSources: ["query", "body"] as const },
      { variant: "actual", inputSources: ["body", "files"] as const },
    ])(
      `should inform on $variant placement of the input security parameter`,
      ({ inputSources }) => {
        expect(
          depictSecurity(
            [{ type: "input", name: "key" }],
            Array.from(inputSources),
          ),
        ).toMatchSnapshot();
      },
    );
    test("should handle OpenID and OAuth2 Securities", () => {
      expect(
        depictSecurity([
          {
            or: [
              { type: "openid", url: "https://test.url" },
              { type: "oauth2" },
            ],
          },
        ]),
      ).toMatchSnapshot();
    });
    test("should depict OAuth2 Security with flows", () => {
      expect(
        depictSecurity([
          {
            type: "oauth2",
            flows: {
              implicit: {
                authorizationUrl: "https://test.url",
                refreshUrl: "https://test2.url",
                scopes: { read: "read something", write: "write something" },
              },
              authorizationCode: {
                authorizationUrl: "https://test.url",
                refreshUrl: "https://test2.url",
                tokenUrl: "https://test3.url",
                scopes: { read: "read something", write: "write something" },
              },
              clientCredentials: {
                refreshUrl: "https://test2.url",
                tokenUrl: "https://test3.url",
                scopes: { read: "read something", write: "write something" },
              },
              password: {
                refreshUrl: "https://test2.url",
                tokenUrl: "https://test3.url",
                scopes: { read: "read something", write: "write something" },
              },
            },
          },
        ]),
      ).toMatchSnapshot();
    });
    test("should handle undefined flows", () => {
      expect(
        depictSecurity([
          {
            type: "oauth2",
            flows: { implicit: undefined, password: undefined },
          },
        ]),
      ).toMatchSnapshot();
    });
    test("should add scopes when missing", () => {
      expect(
        depictSecurity([
          {
            type: "oauth2",
            flows: { password: { tokenUrl: "https://test.url" } },
          },
        ]),
      ).toMatchSnapshot();
    });
  });

  describe("depictTags()", () => {
    test("should accept plain descriptions", () => {
      expect(
        depictTags({
          users: "Everything about users",
          files: "Everything about files processing",
        }),
      ).toMatchSnapshot();
    });

    test("should accept objects with URLs", () => {
      expect(
        depictTags({
          users: { description: "Everything about users" },
          files: {
            description: "Everything about files processing",
            url: "https://example.com",
          },
        }),
      ).toMatchSnapshot();
    });
  });

  describe("ensureShortDescription()", () => {
    test("keeps the short text as it is", () => {
      expect(ensureShortDescription("here is a short text")).toBe(
        "here is a short text",
      );
      expect(ensureShortDescription(" ")).toBe(" ");
      expect(ensureShortDescription("")).toBe("");
    });
    test("trims the long text", () => {
      expect(
        ensureShortDescription(
          "this text is definitely too long for the short description",
        ),
      ).toBe("this text is definitely too long for the short de…");
    });
  });
});
