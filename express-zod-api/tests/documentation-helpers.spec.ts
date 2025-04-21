import { JSONSchema } from "@zod/core";
import * as R from "ramda";
import { z } from "zod";
import { ez } from "../src";
import {
  OpenAPIContext,
  depictExamples,
  depictParamExamples,
  depictRequestParams,
  depictSecurity,
  depictSecurityRefs,
  depictTags,
  ensureShortDescription,
  excludeExamplesFromDepiction,
  excludeParamsFromDepiction,
  defaultIsHeader,
  reformatParamsInPath,
  delegate,
  onNullable,
  onDefault,
  onRaw,
  onUpload,
  onFile,
  onUnion,
  onIntersection,
} from "../src/documentation-helpers";

/**
 * @todo all these functions is now the one, and the tests naming is not relevant anymore
 * @todo these tests should now be transformed into ones of particular postprocessors and assert exactly what they do.
 * @todo So we would not test Zod here, but internal methods only.
 */
describe("Documentation helpers", () => {
  const makeRefMock = vi.fn();
  const requestCtx = {
    ctx: {
      path: "/v1/user/:id",
      method: "get",
      isResponse: false,
      makeRef: makeRefMock,
    } satisfies OpenAPIContext,
  };
  const responseCtx = {
    ctx: {
      path: "/v1/user/:id",
      method: "get",
      isResponse: true,
      makeRef: makeRefMock,
    } satisfies OpenAPIContext,
  };

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
      const depicted = delegate(schema, requestCtx);
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

  describe("onDefault()", () => {
    test("Feature #1706: should override the default value by a label from metadata", () => {
      const zodSchema = z.iso
        .datetime()
        .default(() => new Date().toISOString())
        .label("Today");
      const jsonSchema: JSONSchema.BaseSchema = {
        default: "2025-05-21",
        format: "date-time",
      };
      onDefault({ zodSchema, jsonSchema }, responseCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe("onRaw()", () => {
    test("should extract the raw property", () => {
      const jsonSchema: JSONSchema.ObjectSchema = {
        type: "object",
        properties: { raw: { format: "binary", type: "string" } },
      };
      onRaw({ zodSchema: z.never(), jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe("onUpload()", () => {
    const jsonSchema: JSONSchema.BaseSchema = {};
    const zodSchema = z.never();
    test("should set format:binary and type:string", () => {
      onUpload({ zodSchema, jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });
    test("should throw when using in response", () => {
      expect(() =>
        onUpload({ zodSchema, jsonSchema }, responseCtx.ctx),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("onFile()", () => {
    test.each<JSONSchema.BaseSchema>([
      { type: "string" },
      { anyOf: [{}, { type: "string" }] },
      { type: "string", format: "base64" },
      { anyOf: [], type: "string" },
      {},
    ])("should set type:string and format accordingly %#", (jsonSchema) => {
      onFile({ zodSchema: z.never(), jsonSchema }, responseCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe("onUnion()", () => {
    test("should set discriminator prop for such union", () => {
      const zodSchema = z.discriminatedUnion([
        z.object({ status: z.literal("success"), data: z.any() }),
        z.object({
          status: z.literal("error"),
          error: z.object({ message: z.string() }),
        }),
      ]);
      const jsonSchema: JSONSchema.BaseSchema = {};
      onUnion({ zodSchema, jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });
  });

  describe("onIntersection()", () => {
    test("should flatten two object schemas", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          { type: "object", properties: { one: { type: "number" } } },
          { type: "object", properties: { two: { type: "number" } } },
        ],
      };
      onIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });

    test("should flatten objects with same prop of same type", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          { type: "object", properties: { one: { type: "number" } } },
          { type: "object", properties: { one: { type: "number" } } },
        ],
      };
      onIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });

    test("should NOT flatten object schemas having conflicting props", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          { type: "object", properties: { one: { type: "number" } } },
          { type: "object", properties: { one: { type: "string" } } },
        ],
      };
      onIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });

    test("should merge examples deeply", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          {
            type: "object",
            properties: { a: { type: "number" } },
            examples: [{ a: 123 }],
          },
          {
            type: "object",
            properties: { b: { type: "number" } },
            examples: [{ b: 456 }],
          },
        ],
      };
      onIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });

    test("should maintain uniqueness in the array of required props", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          { type: "object", properties: { test: { type: "number" } } },
          { type: "object", properties: { test: { const: 5 } } },
        ],
      };
      onIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
    });

    test.each<JSONSchema.BaseSchema>([
      {
        allOf: [
          {
            additionalProperties: { type: "number" }, // can not handle
            propertyNames: { type: "string" },
            type: "object",
          },
          {
            properties: { test: { type: "number" } },
            required: ["test"],
            type: "object",
          },
        ],
      },
      {
        allOf: [{ type: "number" }, { const: 5 }], // not objects
      },
    ])("should fall back to allOf in other cases %#", (jsonSchema) => {
      onIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toHaveProperty("allOf");
    });
  });

  describe("onNullable()", () => {
    test.each([requestCtx.ctx, responseCtx.ctx])(
      "should add null type to the first of anyOf %#",
      (ctx) => {
        const jsonSchema: JSONSchema.BaseSchema = {
          anyOf: [{ type: "string" }, { type: "null" }],
        };
        onNullable({ zodSchema: z.never(), jsonSchema }, ctx);
        expect(jsonSchema).toMatchSnapshot();
      },
    );

    test("should not add null type when it's already there", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        anyOf: [{ type: "null" }, { type: "null" }],
      };
      onNullable({ zodSchema: z.never(), jsonSchema }, requestCtx.ctx);
      expect(jsonSchema).toMatchSnapshot();
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
      z.email().min(10).max(20),
      z.url().length(15),
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
    ])("should handle edge cases %#", (schema) => {
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
          ...requestCtx.ctx,
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
          ...requestCtx.ctx,
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
          ...requestCtx.ctx,
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
          ...requestCtx.ctx,
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
