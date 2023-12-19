import assert from "node:assert/strict";
import { ReferenceObject, SchemaObject } from "openapi3-ts/oas31";
import { z } from "zod";
import { defaultSerializer } from "../../src/common-helpers";
import { IOSchemaError } from "../../src/errors";
import {
  DocumentationError,
  defaultEndpointsFactory,
  ez,
  withMeta,
} from "../../src";
import { getMeta } from "../../src/metadata";
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
  depictSecurityRefs,
  depictString,
  depictTags,
  depictTuple,
  depictUnion,
  depictUpload,
  depicters,
  ensureShortDescription,
  excludeExampleFromDepiction,
  excludeParamsFromDepiction,
  extractObjectSchema,
  getRoutePathParams,
  onEach,
  onMissing,
  reformatParamsInPath,
} from "../../src/documentation-helpers";
import { SchemaHandler, walkSchema } from "../../src/schema-walker";
import { serializeSchemaForTest } from "../helpers";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("Documentation helpers", () => {
  const getRefMock = vi.fn();
  const makeRefMock = vi.fn(
    (name: string, {}: SchemaObject | ReferenceObject): ReferenceObject => ({
      $ref: `#/components/schemas/${name}`,
    }),
  );
  const requestCtx: OpenAPIContext = {
    path: "/v1/user/:id",
    method: "get",
    isResponse: false,
    getRef: getRefMock,
    makeRef: makeRefMock,
    serializer: defaultSerializer,
  };
  const responseCtx: OpenAPIContext = {
    path: "/v1/user/:id",
    method: "get",
    isResponse: true,
    getRef: getRefMock,
    makeRef: makeRefMock,
    serializer: defaultSerializer,
  };
  const makeNext =
    (
      ctx: OpenAPIContext,
    ): SchemaHandler<
      z.ZodTypeAny,
      SchemaObject | ReferenceObject,
      {},
      "last"
    > =>
    ({ schema }) =>
      walkSchema({
        schema,
        rules: depicters,
        ...ctx,
        onEach,
        onMissing,
      });

  beforeEach(() => {
    getRefMock.mockClear();
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
      const subject = extractObjectSchema(
        z.object({ one: z.string() }),
        requestCtx,
      );
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test("should return object schema for the union of object schemas", () => {
      const subject = extractObjectSchema(
        z.object({ one: z.string() }).or(z.object({ two: z.number() })),
        requestCtx,
      );
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test("should return object schema for the intersection of object schemas", () => {
      const subject = extractObjectSchema(
        z.object({ one: z.string() }).and(z.object({ two: z.number() })),
        requestCtx,
      );
      expect(subject).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(subject)).toMatchSnapshot();
    });

    test("should preserve examples", () => {
      const objectSchema = withMeta(z.object({ one: z.string() })).example({
        one: "test",
      });
      expect(
        getMeta(extractObjectSchema(objectSchema, requestCtx), "examples"),
      ).toEqual([{ one: "test" }]);

      const refinedObjSchema = withMeta(
        z.object({ one: z.string() }).refine(() => true),
      ).example({ one: "test" });
      expect(
        getMeta(extractObjectSchema(refinedObjSchema, requestCtx), "examples"),
      ).toEqual([{ one: "test" }]);

      const unionSchema = withMeta(
        z.object({ one: z.string() }).or(z.object({ two: z.number() })),
      )
        .example({ one: "test1" })
        .example({ two: 123 });
      expect(
        getMeta(extractObjectSchema(unionSchema, requestCtx), "examples"),
      ).toEqual([{ one: "test1" }, { two: 123 }]);

      const intersectionSchema = withMeta(
        z.object({ one: z.string() }).and(z.object({ two: z.number() })),
      ).example({ one: "test1", two: 123 });
      expect(
        getMeta(
          extractObjectSchema(intersectionSchema, requestCtx),
          "examples",
        ),
      ).toEqual([{ one: "test1", two: 123 }]);
    });

    describe("Feature #600: Top level refinements", () => {
      test("should handle refined object schema", () => {
        const subject = extractObjectSchema(
          z.object({ one: z.string() }).refine(() => true),
          requestCtx,
        );
        expect(subject).toBeInstanceOf(z.ZodObject);
        expect(serializeSchemaForTest(subject)).toMatchSnapshot();
      });

      test("should throw when using transformation", () => {
        expect(() =>
          extractObjectSchema(
            z.object({ one: z.string() }).transform(() => []),
            requestCtx,
          ),
        ).toThrow(
          new IOSchemaError(
            "Using transformations on the top level of input schema is not allowed.\n" +
              "Caused by input schema of an Endpoint assigned to GET method of /v1/user/:id path.",
          ),
        );
      });
    });
  });

  describe("excludeParamsFromDepiction()", () => {
    test.each<z.ZodTypeAny>([
      z.object({ a: z.string(), b: z.string() }),
      z.object({ a: z.string() }).or(z.object({ b: z.string() })),
      z.object({ a: z.string() }).and(z.object({ b: z.string() })),
    ])("should omit specified path params %#", (schema) => {
      const depicted = walkSchema({
        schema,
        ...requestCtx,
        onEach,
        rules: depicters,
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
        depictDefault({
          schema: z.boolean().default(true),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictCatch()", () => {
    test("should pass next depicter", () => {
      expect(
        depictCatch({
          schema: z.boolean().catch(true),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictAny()", () => {
    test("should set format:any", () => {
      expect(
        depictAny({
          schema: z.any(),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictUpload()", () => {
    test("should set format:binary and type:string", () => {
      expect(
        depictUpload({
          schema: ez.upload(),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
    test("should throw when using in response", () => {
      try {
        depictUpload({
          schema: ez.upload(),
          ...responseCtx,
          next: makeNext(responseCtx),
        });
        expect.fail("Should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(DocumentationError);
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("depictFile()", () => {
    test.each([ez.file(), ez.file().binary(), ez.file().base64()])(
      "should set type:string and format accordingly %#",
      (schema) => {
        expect(
          depictFile({
            schema,
            ...responseCtx,
            next: makeNext(responseCtx),
          }),
        ).toMatchSnapshot();
      },
    );
  });

  describe("depictUnion()", () => {
    test("should wrap next depicters into oneOf property", () => {
      expect(
        depictUnion({
          schema: z.string().or(z.number()),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictDiscriminatedUnion()", () => {
    test("should wrap next depicters in oneOf prop and set discriminator prop", () => {
      expect(
        depictDiscriminatedUnion({
          schema: z.discriminatedUnion("status", [
            z.object({ status: z.literal("success"), data: z.any() }),
            z.object({
              status: z.literal("error"),
              error: z.object({ message: z.string() }),
            }),
          ]),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictIntersection()", () => {
    test("should wrap next depicters in allOf property", () => {
      expect(
        depictIntersection({
          schema: z
            .object({ one: z.number() })
            .and(z.object({ two: z.number() })),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictOptional()", () => {
    test.each<OpenAPIContext>([requestCtx, responseCtx])(
      "should pass the next depicter %#",
      (ctx) => {
        expect(
          depictOptional({
            schema: z.string().optional(),
            ...ctx,
            next: makeNext(ctx),
          }),
        ).toMatchSnapshot();
      },
    );
  });

  describe("depictNullable()", () => {
    test.each<OpenAPIContext>([requestCtx, responseCtx])(
      "should add null to the type %#",
      (ctx) => {
        expect(
          depictNullable({
            schema: z.string().nullable(),
            ...ctx,
            next: makeNext(ctx),
          }),
        ).toMatchSnapshot();
      },
    );

    test.each([
      z.string().nullable(),
      z.null().nullable(),
      z.string().nullable().nullable(),
    ])("should only add null type once %#", (schema) => {
      expect(
        depictNullable({
          schema,
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictEnum()", () => {
    enum Test {
      one = "ONE",
      two = "TWO",
    }
    test.each([z.enum(["one", "two"]), z.nativeEnum(Test)])(
      "should set type and enum properties",
      (schema) => {
        expect(
          depictEnum({
            schema,
            ...requestCtx,
            next: makeNext(requestCtx),
          }),
        ).toMatchSnapshot();
      },
    );
  });

  describe("depictLiteral()", () => {
    test("should set type and involve enum property", () => {
      expect(
        depictLiteral({
          schema: z.literal("testing"),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictObject()", () => {
    test.each<{ ctx: OpenAPIContext; shape: z.ZodRawShape }>([
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
        expect(
          depictObject({
            schema: z.object(shape),
            ...ctx,
            next: makeNext(ctx),
          }),
        ).toMatchSnapshot();
      },
    );

    test("Bug #758", () => {
      const schema = z.object({
        a: z.string(),
        b: z.coerce.string(),
        c: z.coerce.string().optional(),
      });
      expect(
        depictObject({
          schema,
          ...responseCtx,
          next: makeNext(responseCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictNull()", () => {
    test("should give type:null", () => {
      expect(
        depictNull({
          schema: z.null(),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictBoolean()", () => {
    test("should set type:boolean", () => {
      expect(
        depictBoolean({
          schema: z.boolean(),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictBigInt()", () => {
    test("should set type:integer and format:bigint", () => {
      expect(
        depictBigInt({
          schema: z.bigint(),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
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
        expect(
          depictRecord({
            schema,
            ...requestCtx,
            next: makeNext(requestCtx),
          }),
        ).toMatchSnapshot();
      },
    );
  });

  describe("depictArray()", () => {
    test("should set type:array and pass items depiction", () => {
      expect(
        depictArray({
          schema: z.array(z.boolean()),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictTuple()", () => {
    test("should utilize prefixItems", () => {
      expect(
        depictTuple({
          schema: z.tuple([z.boolean(), z.string(), z.literal("test")]),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictString()", () => {
    test("should set type:string", () => {
      expect(
        depictString({
          schema: z.string(),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });

    test.each([
      z.string().email().min(10).max(20),
      z.string().url().length(15),
      z.string().uuid(),
      z.string().cuid(),
      z.string().datetime(),
      z.string().datetime({ offset: true }),
      z.string().regex(/^\d+.\d+.\d+$/),
    ])("should set format, pattern and min/maxLength props %#", (schema) => {
      expect(
        depictString({
          schema,
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictNumber()", () => {
    test.each([z.number(), z.number().int().min(10).max(20)])(
      "should type:number, min/max, format and exclusiveness props",
      (schema) => {
        expect(
          depictNumber({
            schema,
            ...requestCtx,
            next: makeNext(requestCtx),
          }),
        ).toMatchSnapshot();
      },
    );
  });

  describe("depictObjectProperties()", () => {
    test("should wrap next depicters in a shape of object", () => {
      expect(
        depictObjectProperties({
          schema: z.object({
            one: z.string(),
            two: z.boolean(),
          }),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictEffect()", () => {
    test.each<{
      ctx: OpenAPIContext;
      schema: z.ZodEffects<any>;
      expected: string;
    }>([
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
      expect(
        depictEffect({
          schema,
          ...ctx,
          next: makeNext(ctx),
        }),
      ).toMatchSnapshot();
    });

    test.each([
      z.number().transform((num) => () => num),
      z.number().transform(() => assert.fail("this should be handled")),
    ])("should handle edge cases", (schema) => {
      expect(
        depictEffect({
          schema,
          ...responseCtx,
          next: makeNext(responseCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictPipeline", () => {
    test.each<{ ctx: OpenAPIContext; expected: string }>([
      { ctx: responseCtx, expected: "boolean (out)" },
      { ctx: requestCtx, expected: "string (in)" },
    ])("should depict as $expected", ({ ctx }) => {
      expect(
        depictPipeline({
          schema: z.string().pipe(z.coerce.boolean()),
          ...ctx,
          next: makeNext(ctx),
        }),
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
          withMeta(
            z.object({
              one: z.string().transform((v) => v.length),
              two: z.number().transform((v) => `${v}`),
              three: z.boolean(),
            }),
          )
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
    test.each<{ isResponse: boolean } & Record<"case" | "action", string>>([
      { isResponse: false, case: "request", action: "pass" },
      { isResponse: true, case: "response", action: "transform" },
    ])("should $action examples in case of $case", ({ isResponse }) => {
      expect(
        depictParamExamples(
          withMeta(
            z.object({
              one: z.string().transform((v) => v.length),
              two: z.number().transform((v) => `${v}`),
              three: z.boolean(),
            }),
          )
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
          "two",
        ),
      ).toMatchSnapshot();
    });
  });

  describe("depictRequestParams()", () => {
    test("should depict query and path params", () => {
      expect(
        depictRequestParams({
          endpoint: defaultEndpointsFactory.build({
            methods: ["get", "put", "delete"],
            input: z.object({
              id: z.string(),
              test: z.boolean(),
            }),
            output: z.object({}),
            handler: vi.fn(),
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
          endpoint: defaultEndpointsFactory.build({
            methods: ["get", "put", "delete"],
            input: z.object({
              id: z.string(),
              test: z.boolean(),
            }),
            output: z.object({}),
            handler: vi.fn(),
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
          endpoint: defaultEndpointsFactory.build({
            methods: ["get", "put", "delete"],
            input: z.object({
              id: z.string(),
              test: z.boolean(),
            }),
            output: z.object({}),
            handler: vi.fn(),
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
          endpoint: defaultEndpointsFactory.build({
            method: "get",
            input: z.object({
              "x-request-id": z.string(),
              id: z.string(),
              test: z.boolean(),
            }),
            output: z.object({}),
            handler: vi.fn(),
          }),
          inputSources: ["query", "headers", "params"],
          composition: "inline",
          ...requestCtx,
        }),
      ).toMatchSnapshot();
    });
  });

  describe("excludeExampleFromDepiction()", () => {
    test("should remove example property of supplied object", () => {
      expect(
        excludeExampleFromDepiction({
          type: "string",
          description: "test",
          example: "test",
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictDateIn", () => {
    test("should set type:string, pattern and format", () => {
      expect(
        depictDateIn({
          schema: ez.dateIn(),
          ...requestCtx,
          next: makeNext(requestCtx),
        }),
      ).toMatchSnapshot();
    });
    test("should throw when ZodDateIn in response", () => {
      try {
        depictDateIn({
          schema: ez.dateIn(),
          ...responseCtx,
          next: makeNext(responseCtx),
        });
        expect.fail("should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(DocumentationError);
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("depictDateOut", () => {
    test("should set type:string, description and format", () => {
      expect(
        depictDateOut({
          schema: ez.dateOut(),
          ...responseCtx,
          next: makeNext(responseCtx),
        }),
      ).toMatchSnapshot();
    });
    test("should throw when ZodDateOut in request", () => {
      try {
        depictDateOut({
          schema: ez.dateOut(),
          ...requestCtx,
          next: makeNext(requestCtx),
        });
        expect.fail("should not be here");
      } catch (e) {
        expect(e).toBeInstanceOf(DocumentationError);
        expect(e).toMatchSnapshot();
      }
    });
  });

  describe("depictDate", () => {
    test.each<OpenAPIContext>([responseCtx, requestCtx])(
      "should throw clear error %#",
      (ctx) => {
        try {
          depictDate({
            schema: z.date(),
            ...ctx,
            next: makeNext(ctx),
          });
          expect.fail("should not be here");
        } catch (e) {
          expect(e).toBeInstanceOf(DocumentationError);
          expect(e).toMatchSnapshot();
        }
      },
    );
  });

  describe("depictBranded", () => {
    test("should pass the next depicter", () => {
      expect(
        depictBranded({
          schema: z.string().min(2).brand<"Test">(),
          ...responseCtx,
          next: makeNext(responseCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictReadonly", () => {
    test("should pass the next depicter", () => {
      expect(
        depictReadonly({
          schema: z.string().readonly(),
          ...responseCtx,
          next: makeNext(responseCtx),
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictLazy", () => {
    const recursiveArray: z.ZodLazy<z.ZodArray<any>> = z.lazy(() =>
      recursiveArray.array(),
    );
    const directlyRecursive: z.ZodLazy<any> = z.lazy(() => directlyRecursive);
    const recursiveObject: z.ZodLazy<z.ZodObject<any>> = z.lazy(() =>
      z.object({ prop: recursiveObject }),
    );

    test.each([
      {
        schema: recursiveArray,
        hash: "6cbbd837811754902ea1e68d3e5c75e36250b880",
      },
      {
        schema: directlyRecursive,
        hash: "7a225c55e65ab4a2fd3ce390265b255ee6747049",
      },
      {
        schema: recursiveObject,
        hash: "118cb3b11b8a1f3b6b1e60a89f96a8be9da32a0f",
      },
    ])("should handle circular references %#", ({ schema, hash }) => {
      getRefMock
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(
          (name: string): ReferenceObject => ({
            $ref: `#/components/schemas/${name}`,
          }),
        );
      expect(getRefMock.mock.calls.length).toBe(0);
      expect(
        depictLazy({
          schema,
          ...responseCtx,
          next: makeNext(responseCtx),
        }),
      ).toMatchSnapshot();
      expect(getRefMock).toHaveBeenCalledTimes(2);
      for (const call of getRefMock.mock.calls) {
        expect(call[0]).toBe(hash);
      }
      expect(makeRefMock).toHaveBeenCalledTimes(2);
      expect(makeRefMock.mock.calls[0]).toEqual([hash, {}]);
      expect(makeRefMock.mock.calls[1][0]).toBe(hash);
      expect(makeRefMock.mock.calls[1][1]).toMatchSnapshot();
    });
  });

  describe("depictSecurity()", () => {
    test("should handle Basic, Bearer and CustomHeader Securities", () => {
      expect(
        depictSecurity({
          or: [
            { and: [{ type: "basic" }, { type: "bearer" }] },
            { type: "header", name: "X-Key" },
          ],
        }),
      ).toMatchSnapshot();
    });
    test("should handle Input and Cookie Securities", () => {
      expect(
        depictSecurity({
          and: [
            {
              or: [
                { type: "input", name: "apiKey" },
                { type: "cookie", name: "hash" },
              ],
            },
          ],
        }),
      ).toMatchSnapshot();
    });
    test("should handle OpenID and OAuth2 Securities", () => {
      expect(
        depictSecurity({
          or: [{ type: "openid", url: "https://test.url" }, { type: "oauth2" }],
        }),
      ).toMatchSnapshot();
    });
    test("should depict OAuth2 Security with flows", () => {
      expect(
        depictSecurity({
          type: "oauth2",
          flows: {
            implicit: {
              authorizationUrl: "https://test.url",
              refreshUrl: "https://test2.url",
              scopes: {
                read: "read something",
                write: "write something",
              },
            },
            authorizationCode: {
              authorizationUrl: "https://test.url",
              refreshUrl: "https://test2.url",
              tokenUrl: "https://test3.url",
              scopes: {
                read: "read something",
                write: "write something",
              },
            },
            clientCredentials: {
              refreshUrl: "https://test2.url",
              tokenUrl: "https://test3.url",
              scopes: {
                read: "read something",
                write: "write something",
              },
            },
            password: {
              refreshUrl: "https://test2.url",
              tokenUrl: "https://test3.url",
              scopes: {
                read: "read something",
                write: "write something",
              },
            },
          },
        }),
      ).toMatchSnapshot();
    });
    test("should handle undefined flows", () => {
      expect(
        depictSecurity({
          type: "oauth2",
          flows: {
            implicit: undefined,
            password: undefined,
          },
        }),
      ).toMatchSnapshot();
    });
  });

  describe("depictSecurityRefs()", () => {
    test("should handle LogicalAnd", () => {
      expect(
        depictSecurityRefs({
          and: [
            { name: "A", scopes: [] },
            { name: "B", scopes: [] },
            { name: "C", scopes: [] },
          ],
        }),
      ).toMatchSnapshot();
      expect(
        depictSecurityRefs({
          and: [
            { name: "A", scopes: [] },
            {
              or: [
                { name: "B", scopes: [] },
                { name: "C", scopes: [] },
              ],
            },
          ],
        }),
      ).toMatchSnapshot();
    });

    test("should handle LogicalOr", () => {
      expect(
        depictSecurityRefs({
          or: [
            { name: "A", scopes: [] },
            { name: "B", scopes: [] },
            { name: "C", scopes: [] },
          ],
        }),
      ).toMatchSnapshot();
      expect(
        depictSecurityRefs({
          or: [
            { name: "A", scopes: [] },
            {
              and: [
                { name: "B", scopes: [] },
                { name: "C", scopes: [] },
              ],
            },
          ],
        }),
      ).toMatchSnapshot();
    });

    test("should handle the plain value", () => {
      expect(depictSecurityRefs({ name: "A", scopes: [] })).toMatchSnapshot();
    });

    test("should populate the scopes", () => {
      expect(
        depictSecurityRefs({
          or: [
            { name: "A", scopes: ["write"] },
            { name: "B", scopes: ["read"] },
            { name: "C", scopes: ["read", "write"] },
          ],
        }),
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
