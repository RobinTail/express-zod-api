import type { $ZodType } from "@zod/core";
import { ReferenceObject } from "openapi3-ts/oas31";
import * as R from "ramda";
import { z } from "zod";
import { ez } from "../src";
import {
  OpenAPIContext,
  depictExamples,
  depictFile,
  depictParamExamples,
  depictRequestParams,
  depictSecurity,
  depictSecurityRefs,
  depictTags,
  depictUpload,
  depictRaw,
  depicters,
  ensureShortDescription,
  excludeExamplesFromDepiction,
  excludeParamsFromDepiction,
  defaultIsHeader,
  onEach,
  onMissing,
  reformatParamsInPath,
  delegate,
} from "../src/documentation-helpers";
import { walkSchema } from "../src/schema-walker";

describe("Documentation helpers", () => {
  const makeRefMock = vi.fn();
  const requestCtx = {
    path: "/v1/user/:id",
    method: "get",
    isResponse: false,
    makeRef: makeRefMock,
    next: (schema: $ZodType) =>
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
    next: (schema: $ZodType) =>
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

  describe("excludeParamsFromDepiction()", () => {
    test.each<z.ZodTypeAny>([
      z.object({ a: z.string(), b: z.string() }),
      z.object({ a: z.string() }).or(z.object({ b: z.string() })),
      z.intersection(z.object({ a: z.string() }), z.object({ b: z.string() })), // flattened
      z.intersection(
        z.record(z.literal("a"), z.string()),
        z.record(z.string(), z.string()),
      ),
    ])("should omit specified params %#", (schema) => {
      const depicted = walkSchema(schema, {
        ctx: requestCtx,
        rules: depicters,
        onEach,
        onMissing,
      });
      const [result, hasRequired] = excludeParamsFromDepiction(depicted, ["a"]);
      expect(result).toMatchSnapshot();
      expect(hasRequired).toMatchSnapshot();
    });

    test("should handle the ReferenceObject", () => {
      const [result, hasRequired] = excludeParamsFromDepiction(
        { $ref: "test" },
        ["a"],
      );
      expect(result).toMatchSnapshot();
      expect(hasRequired).toBe(false);
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
      expect(delegate(z.boolean().default(true), requestCtx)).toMatchSnapshot();
    });
    test("Feature #1706: should override the default value by a label from metadata", () => {
      expect(
        delegate(
          z.iso
            .datetime()
            .default(() => new Date().toISOString())
            .label("Today"),
          responseCtx,
        ),
      ).toMatchSnapshot();
    });
  });

  describe("depictWrapped()", () => {
    test("should handle catch", () => {
      expect(delegate(z.boolean().catch(true), requestCtx)).toMatchSnapshot();
    });

    test.each([requestCtx, responseCtx])("should handle optional %#", (ctx) => {
      expect(delegate(z.string().optional(), ctx)).toMatchSnapshot();
    });

    test("handle readonly", () => {
      expect(delegate(z.string().readonly(), responseCtx)).toMatchSnapshot();
    });
  });

  describe("depictAny()", () => {
    test("should set format:any", () => {
      expect(delegate(z.any(), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictRaw()", () => {
    test("should depict the raw property", () => {
      expect(
        depictRaw(ez.raw({ extra: z.string() }), requestCtx),
      ).toMatchSnapshot();
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
      expect(delegate(z.string().or(z.number()), requestCtx)).toMatchSnapshot();
    });

    test("should wrap next depicters in oneOf prop and set discriminator prop", () => {
      expect(
        delegate(
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
        delegate(
          z.intersection(
            z.object({ one: z.number() }),
            z.object({ two: z.number() }),
          ),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test("should flatten objects with same prop of same type", () => {
      expect(
        delegate(
          z.intersection(
            z.object({ one: z.number() }),
            z.object({ one: z.number() }),
          ),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test("should NOT flatten object schemas having conflicting props", () => {
      expect(
        delegate(
          z.intersection(
            z.object({ one: z.number() }),
            z.object({ one: z.string() }),
          ),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test("should merge examples deeply", () => {
      expect(
        delegate(
          z.intersection(
            z
              .object({ test: z.object({ a: z.number() }) })
              .example({ test: { a: 123 } }),
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
        delegate(
          z.intersection(
            z.intersection(
              z.object({ one: z.number() }).example({ one: 123 }),
              z.object({ two: z.number() }).example({ two: 456 }),
            ),
            z.object({ three: z.number() }).example({ three: 789 }),
          ),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test("should maintain uniqueness in the array of required props", () => {
      expect(
        delegate(
          z.intersection(
            z.object({ test: z.number() }),
            z.object({ test: z.literal(5) }),
          ),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });

    test.each([
      z.intersection(
        z.record(z.string(), z.number()), // has additionalProperties
        z.object({ test: z.number() }),
      ),
      z.intersection(z.number(), z.literal(5)), // not objects
    ])("should fall back to allOf in other cases %#", (schema) => {
      expect(delegate(schema, requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictNullable()", () => {
    test.each([requestCtx, responseCtx])(
      "should add null to the type %#",
      (ctx) => {
        expect(delegate(z.string().nullable(), ctx)).toMatchSnapshot();
      },
    );

    test.each([z.null().nullable(), z.string().nullable().nullable()])(
      "should not add null type when it's already there %#",
      (schema) => {
        expect(delegate(schema, requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictEnum()", () => {
    enum Test {
      one = "ONE",
      two = "TWO",
    }
    test.each([z.enum(["one", "two"]), z.enum(Test)])(
      "should set type and enum properties",
      (schema) => {
        expect(delegate(schema, requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictLiteral()", () => {
    // @todo wait for external issue fixed
    test.each(["testng", null /* BigInt(123), undefined */])(
      "should set type and involve const property %#",
      (value) => {
        expect(delegate(z.literal(value), requestCtx)).toMatchSnapshot();
      },
    );

    test("should handle multiple values", () => {
      expect(delegate(z.literal([1, 2, 3]), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictObject()", () => {
    test.each([
      { ctx: requestCtx, shape: { a: z.number(), b: z.string() } },
      { ctx: responseCtx, shape: { a: z.number(), b: z.string() } },
      {
        ctx: responseCtx,
        shape: { a: z.coerce.number(), b: z.coerce.string() },
      },
      { ctx: responseCtx, shape: { a: z.number(), b: z.string().optional() } },
      {
        ctx: requestCtx,
        shape: { a: z.number().optional(), b: z.coerce.string() },
      },
    ])(
      "should type:object, properties and required props %#",
      ({ shape, ctx }) => {
        expect(delegate(z.object(shape), ctx)).toMatchSnapshot();
      },
    );

    test("Bug #758", () => {
      const schema = z.object({
        a: z.string(),
        b: z.coerce.string(),
        c: z.coerce.string().optional(),
      });
      expect(delegate(schema, responseCtx)).toMatchSnapshot();
    });
  });

  describe("depictNull()", () => {
    test("should give type:null", () => {
      expect(delegate(z.null(), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictBoolean()", () => {
    test("should set type:boolean", () => {
      expect(delegate(z.boolean(), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictBigInt()", () => {
    test("should set type:integer and format:bigint", () => {
      expect(delegate(z.bigint(), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictRecord()", () => {
    test.each([
      z.record(z.int(), z.boolean()),
      z.record(z.string(), z.boolean()),
      z.record(z.enum(["one", "two"]), z.boolean()),
      z.record(z.literal("testing"), z.boolean()),
      z.record(z.literal("one").or(z.literal("two")), z.boolean()),
      z.record(z.string(), z.any()), // Issue #900
      z.record(z.string().regex(/x-\w+/), z.boolean()),
    ])(
      "should set properties+required or additionalProperties props %#",
      (schema) => {
        expect(delegate(schema, requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictArray()", () => {
    test("should set type:array and pass items depiction", () => {
      expect(delegate(z.array(z.boolean()), requestCtx)).toMatchSnapshot();
    });

    test.each([
      z.boolean().array().min(3),
      z.boolean().array().max(5),
      z.boolean().array().min(3).max(5),
      z.boolean().array().length(4),
      z.array(z.boolean()).nonempty(),
    ])("should reflect min/max/exact length of the array %#", (schema) => {
      expect(delegate(schema, requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictTuple()", () => {
    test("should utilize prefixItems and set items:not:{}", () => {
      expect(
        delegate(
          z.tuple([z.boolean(), z.string(), z.literal("test")]),
          requestCtx,
        ),
      ).toMatchSnapshot();
    });
    test("should depict rest as items when defined", () => {
      expect(
        delegate(z.tuple([z.boolean()]).rest(z.string()), requestCtx),
      ).toMatchSnapshot();
    });
    test("should depict empty tuples as is", () => {
      expect(delegate(z.tuple([]), requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictString()", () => {
    test("should set type:string", () => {
      expect(delegate(z.string(), requestCtx)).toMatchSnapshot();
    });

    test.each([
      z.string().email().min(10).max(20),
      z.string().url().length(15),
      z.uuid(),
      z.cuid(),
      z.iso.datetime(),
      z.iso.datetime({ offset: true }),
      z.string().regex(/^\d+.\d+.\d+$/),
      z.iso.date(),
      z.iso.time(),
      z.iso.duration(),
      z.cidrv4(),
      z.ipv4(),
      z.jwt(),
      z.base64(),
      z.base64url(),
      z.cuid2(),
      z.ulid(),
    ])("should set format, pattern and min/maxLength props %#", (schema) => {
      expect(delegate(schema, requestCtx)).toMatchSnapshot();
    });
  });

  describe("depictNumber()", () => {
    test.each([z.number(), z.int(), z.float64()])(
      "should set min/max values according to JS capabilities %#",
      (schema) => {
        expect(delegate(schema, requestCtx)).toMatchSnapshot();
      },
    );

    test.each([
      z
        .number()
        .min(-100 / 3)
        .max(100 / 3),
      z.number().int().min(-100).max(100),
      z
        .number()
        .gt(-100 / 6)
        .lt(100 / 6),
      z.number().int().gt(-100).lt(100),
    ])(
      "should use schema checks for min/max and exclusiveness %#",
      (schema) => {
        expect(delegate(schema, requestCtx)).toMatchSnapshot();
      },
    );
  });

  describe("depictPipeline", () => {
    test.each([
      { ctx: responseCtx, expected: "boolean (out)" },
      { ctx: requestCtx, expected: "string (in)" },
    ])("should depict as $expected", ({ ctx }) => {
      expect(
        delegate(z.string().transform(Boolean).pipe(z.boolean()), ctx),
      ).toMatchSnapshot();
    });

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
    ])("should depict as $expected", ({ schema, ctx }) => {
      expect(delegate(schema, ctx)).toMatchSnapshot();
    });

    test.each([
      z.number().transform((num) => () => num),
      z.number().transform(() => assert.fail("this should be handled")),
    ])("should handle edge cases", (schema) => {
      expect(delegate(schema, responseCtx)).toMatchSnapshot();
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

  describe("defaultIsHeader()", () => {
    test.each([
      { name: "x-request-id", expected: true },
      { name: "authorization", expected: true },
      {
        name: "secure",
        familiar: ["secure"],
        expected: true,
      },
      { name: "unknown", expected: false },
    ])(
      "should validate custom, well-known and security headers %#",
      ({ name, familiar, expected }) => {
        expect(defaultIsHeader(name, familiar)).toBe(expected);
      },
    );
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

    test("Features 1180 and 2344: should depict header params when enabled", () => {
      expect(
        depictRequestParams({
          schema: z.object({
            "x-request-id": z.string(),
            id: z.string(),
            test: z.boolean(),
            secure: z.string(),
          }),
          inputSources: ["query", "headers", "params"],
          composition: "inline",
          security: [[{ type: "header", name: "secure" }]],
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
      expect(delegate(ez.dateIn(), requestCtx)).toMatchSnapshot();
    });
    test("should throw when ZodDateIn in response", () => {
      expect(() =>
        delegate(ez.dateIn(), responseCtx),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("depictDateOut", () => {
    test("should set type:string, description and format", () => {
      expect(delegate(ez.dateOut(), responseCtx)).toMatchSnapshot();
    });
    test("should throw when ZodDateOut in request", () => {
      expect(() =>
        delegate(ez.dateOut(), requestCtx),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("depictLazy", () => {
    const recursiveArray: z.ZodLazy = z.lazy(() => recursiveArray.array());
    const directlyRecursive: z.ZodLazy = z.lazy(() => directlyRecursive);
    const recursiveObject: z.ZodLazy = z.lazy(() =>
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
        expect(delegate(schema, responseCtx)).toMatchSnapshot();
        expect(makeRefMock).toHaveBeenCalledTimes(1);
        expect(makeRefMock).toHaveBeenCalledWith(
          schema._zod.def.getter,
          expect.any(Function),
        );
      },
    );
  });

  describe("depictSecurity()", () => {
    test("should handle Basic, Bearer and Header Securities", () => {
      expect(
        depictSecurity([
          [{ type: "basic" }, { type: "bearer" }],
          [{ type: "header", name: "X-Key" }],
        ]),
      ).toMatchSnapshot();
    });
    test("should handle Input and Cookie Securities", () => {
      expect(
        depictSecurity([
          [{ type: "input", name: "apiKey" }],
          [{ type: "cookie", name: "hash" }],
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
            [[{ type: "input", name: "key" }]],
            Array.from(inputSources),
          ),
        ).toMatchSnapshot();
      },
    );
    test("should handle OpenID and OAuth2 Securities", () => {
      expect(
        depictSecurity([
          [{ type: "openid", url: "https://test.url" }],
          [{ type: "oauth2" }],
        ]),
      ).toMatchSnapshot();
    });
    test("should depict OAuth2 Security with flows", () => {
      expect(
        depictSecurity([
          [
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
          ],
        ]),
      ).toMatchSnapshot();
    });
    test("should handle undefined flows", () => {
      expect(
        depictSecurity([
          [
            {
              type: "oauth2",
              flows: { implicit: undefined, password: undefined },
            },
          ],
        ]),
      ).toMatchSnapshot();
    });
    test("should add scopes when missing", () => {
      expect(
        depictSecurity([
          [
            {
              type: "oauth2",
              flows: { password: { tokenUrl: "https://test.url" } },
            },
          ],
        ]),
      ).toMatchSnapshot();
    });
  });

  describe("depictSecurityRefs()", () => {
    test("should handle alternatives", () => {
      expect(
        depictSecurityRefs(
          [[{ type: "apiKey" }, { type: "oauth2" }, { type: "openIdConnect" }]],
          [],
          R.prop("type"),
        ),
      ).toMatchSnapshot();
      expect(
        depictSecurityRefs(
          [
            [{ type: "apiKey" }, { type: "oauth2" }],
            [{ type: "apiKey" }, { type: "openIdConnect" }],
          ],
          [],
          R.prop("type"),
        ),
      ).toMatchSnapshot();
      expect(
        depictSecurityRefs(
          [
            [{ type: "apiKey" }],
            [{ type: "oauth2" }],
            [{ type: "openIdConnect" }],
          ],
          [],
          R.prop("type"),
        ),
      ).toMatchSnapshot();
    });

    test("should populate the scopes", () => {
      expect(
        depictSecurityRefs(
          [
            [{ type: "apiKey" }],
            [{ type: "oauth2" }],
            [{ type: "openIdConnect" }],
          ],
          ["read", "write"],
          R.prop("type"),
        ),
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
