import type { JSONSchema } from "zod/v4/core";
import { SchemaObject } from "openapi3-ts/oas31";
import * as R from "ramda";
import { z } from "zod/v4";
import { ez } from "../src";
import {
  OpenAPIContext,
  depictRequestParams,
  depictSecurity,
  depictSecurityRefs,
  depictTags,
  ensureShortDescription,
  excludeParamsFromDepiction,
  defaultIsHeader,
  reformatParamsInPath,
  depictNullable,
  depictRaw,
  depictUpload,
  depictFile,
  depictUnion,
  depictIntersection,
  depictBigInt,
  depictTuple,
  depictPipeline,
  depictDateIn,
  depictDateOut,
  depictBody,
  depictEnum,
  depictLiteral,
  depictRequest,
} from "../src/documentation-helpers";

describe("Documentation helpers", () => {
  const makeRefMock = vi.fn();
  const requestCtx: OpenAPIContext = {
    path: "/v1/user/:id",
    method: "get",
    isResponse: false,
    makeRef: makeRefMock,
  };
  const responseCtx: OpenAPIContext = {
    path: "/v1/user/:id",
    method: "get",
    isResponse: true,
    makeRef: makeRefMock,
  };

  beforeEach(() => {
    makeRefMock.mockClear();
  });

  describe("excludeParamsFromDepiction()", () => {
    test.each<SchemaObject>([
      {
        type: "object",
        properties: { a: { type: "string" }, b: { type: "string" } },
        required: ["a", "b"],
      },
      {
        anyOf: [
          {
            type: "object",
            properties: { a: { type: "string" } },
            required: ["a"],
          },
          {
            type: "object",
            properties: { b: { type: "string" } },
            required: ["b"],
          },
        ],
      },
      {
        type: "object",
        properties: { a: { type: "string" }, b: { type: "string" } },
        required: ["a", "b"],
      },
      {
        allOf: [
          {
            type: "object",
            propertyNames: { const: "a" },
            additionalProperties: { type: "string" },
          },
          {
            type: "object",
            propertyNames: { type: "string" },
            additionalProperties: { type: "string" },
          },
        ],
      },
    ])("should omit specified params %#", (depicted) => {
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

  describe("depictRaw()", () => {
    test("should extract the raw property", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        type: "object",
        properties: { raw: { format: "binary", type: "string" } },
      };
      expect(
        depictRaw({ zodSchema: z.never(), jsonSchema }, requestCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictUpload()", () => {
    test("should set format:binary and type:string", () => {
      expect(
        depictUpload({ zodSchema: z.never(), jsonSchema: {} }, requestCtx),
      ).toMatchSnapshot();
    });
    test("should throw when using in response", () => {
      expect(() =>
        depictUpload({ zodSchema: z.never(), jsonSchema: {} }, responseCtx),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("depictFile()", () => {
    test.each<JSONSchema.BaseSchema>([
      { type: "string" },
      { anyOf: [{}, { type: "string" }] },
      { type: "string", format: "base64" },
      { anyOf: [], type: "string" },
      {},
    ])("should set type:string and format accordingly %#", (jsonSchema) => {
      expect(
        depictFile({ zodSchema: z.never(), jsonSchema }, responseCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictUnion()", () => {
    test("should set discriminator prop for such union", () => {
      const zodSchema = z.discriminatedUnion("status", [
        z.object({ status: z.literal("success"), data: z.any() }),
        z.object({
          status: z.literal("error"),
          error: z.object({ message: z.string() }),
        }),
      ]);
      expect(
        depictUnion({ zodSchema, jsonSchema: {} }, requestCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictIntersection()", () => {
    test("should flatten two object schemas", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          {
            type: "object",
            description: "some",
            properties: { one: { type: "number" } },
          },
          { type: "object", properties: { two: { type: "number" } } },
        ],
      };
      expect(
        depictIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx),
      ).toMatchSnapshot();
    });

    test("should flatten objects with same prop of same type", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          { type: "object", properties: { one: { type: "number" } } },
          { type: "object", properties: { one: { type: "number" } } },
        ],
      };
      expect(
        depictIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx),
      ).toMatchSnapshot();
    });

    test("should NOT flatten object schemas having conflicting props", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          { type: "object", properties: { one: { type: "number" } } },
          { type: "object", properties: { one: { type: "string" } } },
        ],
      };
      expect(
        depictIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx),
      ).toMatchSnapshot();
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
      expect(
        depictIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx),
      ).toMatchSnapshot();
    });

    test("should maintain uniqueness in the array of required props", () => {
      const jsonSchema: JSONSchema.BaseSchema = {
        allOf: [
          {
            type: "object",
            properties: { test: { type: "number" } },
            required: ["test"],
          },
          {
            type: "object",
            properties: { test: { const: 5 } },
            required: ["test"],
          },
        ],
      };
      expect(
        depictIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx),
      ).toMatchSnapshot();
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
      expect(
        depictIntersection({ zodSchema: z.never(), jsonSchema }, requestCtx),
      ).toHaveProperty("allOf");
    });
  });

  describe("depictNullable()", () => {
    test.each([requestCtx, responseCtx])(
      "should add null type to the first of anyOf %#",
      (ctx) => {
        const jsonSchema: JSONSchema.BaseSchema = {
          anyOf: [{ type: "string" }, { type: "null" }],
        };
        expect(
          depictNullable({ zodSchema: z.never(), jsonSchema }, ctx),
        ).toMatchSnapshot();
      },
    );

    test.each([
      { type: "null" },
      {
        anyOf: [{ type: "null" }, { type: "null" }],
      },
      {
        anyOf: [
          { type: ["string", "null"] as unknown as string }, // nullable of nullable case
          { type: "null" },
        ],
      },
    ])("should not add null type when it's already there %#", (jsonSchema) => {
      expect(
        depictNullable({ zodSchema: z.never(), jsonSchema }, requestCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictEnum()", () => {
    test("should set type", () => {
      expect(
        depictEnum(
          { zodSchema: z.never(), jsonSchema: { enum: ["test", "jest"] } },
          requestCtx,
        ),
      ).toMatchSnapshot();
    });
  });

  describe("depictLiteral()", () => {
    test.each([{ const: "test" }, { enum: ["test", "jest"] }])(
      "should set type from either const or enum prop %#",
      (jsonSchema) => {
        expect(
          depictLiteral({ zodSchema: z.never(), jsonSchema }, requestCtx),
        ).toMatchSnapshot();
      },
    );
  });

  describe("depictBigInt()", () => {
    test("should set type:string and format:bigint", () => {
      expect(
        depictBigInt({ zodSchema: z.never(), jsonSchema: {} }, requestCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictTuple()", () => {
    test.each([
      z.tuple([z.boolean(), z.string(), z.literal("test")]),
      z.tuple([]),
    ])("should add items:not:{} when no rest %#", (zodSchema) => {
      expect(
        depictTuple({ zodSchema, jsonSchema: {} }, requestCtx),
      ).toMatchSnapshot();
    });
  });

  describe("depictPipeline", () => {
    test.each([
      {
        zodSchema: z.string().transform((v) => parseInt(v, 10)),
        ctx: responseCtx,
        expected: "number (out)",
      },
      {
        zodSchema: z.preprocess((v) => parseInt(`${v}`, 10), z.string()),
        ctx: requestCtx,
        expected: "string (preprocess)",
      },
    ])("should depict as $expected", ({ zodSchema, ctx }) => {
      expect(
        depictPipeline({ zodSchema, jsonSchema: {} }, ctx),
      ).toMatchSnapshot();
    });

    test.each([
      z.number().transform((num) => () => num),
      z.number().transform(() => assert.fail("this should be handled")),
    ])("should handle edge cases %#", (zodSchema) => {
      expect(
        depictPipeline({ zodSchema, jsonSchema: {} }, responseCtx),
      ).toEqual({});
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

  describe("depictRequest", () => {
    test("should simply delegate it all to Zod 4", () => {
      expect(
        depictRequest({
          schema: z.object({
            id: z.string(),
            test: z.boolean(),
          }),
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictRequestParams()", () => {
    test("should depict query and path params", () => {
      expect(
        depictRequestParams({
          request: {
            properties: {
              id: { type: "string" },
              test: { type: "boolean" },
            },
            required: ["id", "test"],
            type: "object",
          },
          inputSources: ["query", "params"],
          composition: "inline",
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });

    test("should depict only path params if query is disabled", () => {
      expect(
        depictRequestParams({
          request: {
            properties: {
              id: { type: "string" },
              test: { type: "boolean" },
            },
            required: ["id", "test"],
            type: "object",
          },
          inputSources: ["body", "params"],
          composition: "inline",
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });

    test("should depict none if both query and params are disabled", () => {
      expect(
        depictRequestParams({
          request: {
            properties: {
              id: { type: "string" },
              test: { type: "boolean" },
            },
            required: ["id", "test"],
            type: "object",
          },
          inputSources: ["body"],
          composition: "inline",
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });

    test("Features 1180 and 2344: should depict header params when enabled", () => {
      expect(
        depictRequestParams({
          request: {
            properties: {
              "x-request-id": { type: "string" },
              id: { type: "string" },
              test: { type: "boolean" },
              secure: { type: "string" },
            },
            required: ["x-request-id", "id", "test", "secure"],
            type: "object",
          },
          inputSources: ["query", "headers", "params"],
          composition: "inline",
          security: [[{ type: "header", name: "secure" }]],
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictBody", () => {
    test("should mark ez.raw() body as required", () => {
      const body = depictBody({
        ...requestCtx,
        schema: ez.raw(),
        request: { type: "string", format: "binary" },
        composition: "inline",
        mimeType: "application/octet-stream", // raw content type
        paramNames: [],
      });
      expect(body.required).toBe(true);
    });
  });

  describe("depictDateIn", () => {
    test.each([
      { examples: undefined },
      { examples: [] },
      { examples: ["2024-01-01"] },
    ])("should set type:string, pattern and format %#", ({ examples }) => {
      expect(
        depictDateIn(
          { zodSchema: z.never(), jsonSchema: { anyOf: [], examples } },
          requestCtx,
        ),
      ).toMatchSnapshot();
    });
    test("should throw when ZodDateIn in response", () => {
      expect(() =>
        depictDateIn({ zodSchema: z.never(), jsonSchema: {} }, responseCtx),
      ).toThrowErrorMatchingSnapshot();
    });
  });

  describe("depictDateOut", () => {
    test.each([
      { examples: undefined },
      { examples: [] },
      { examples: ["2024-01-01"] },
    ])("should set type:string, description and format %#", ({ examples }) => {
      expect(
        depictDateOut(
          { zodSchema: z.never(), jsonSchema: { examples } },
          responseCtx,
        ),
      ).toMatchSnapshot();
    });
    test("should throw when ZodDateOut in request", () => {
      expect(() =>
        depictDateOut({ zodSchema: z.never(), jsonSchema: {} }, requestCtx),
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
