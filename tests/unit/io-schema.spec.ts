import { expectNotType, expectType } from "tsd";
import { z } from "zod";
import { IOSchema, Middleware, ez } from "../../src";
import { getFinalEndpointInputSchema } from "../../src/io-schema";
import { metaSymbol } from "../../src/metadata";
import { AbstractMiddleware } from "../../src/middleware";
import { serializeSchemaForTest } from "../helpers";
import { describe, expect, test, vi } from "vitest";

describe("I/O Schema and related helpers", () => {
  describe("IOSchema", () => {
    test("accepts object", () => {
      expectType<IOSchema>(z.object({}));
      expectType<IOSchema<"strip">>(z.object({}));
      expectType<IOSchema<"strict">>(z.object({}).strict());
      expectType<IOSchema<"passthrough">>(z.object({}).passthrough());
      expectType<IOSchema<"strip">>(z.object({}).strip());
    });
    test("accepts ez.raw()", () => {
      expectType<IOSchema>(ez.raw());
      expectType<IOSchema>(ez.raw({ something: z.any() }));
    });
    test("respects the UnknownKeys type argument", () => {
      expectNotType<IOSchema<"passthrough">>(z.object({}));
    });
    test("accepts union of objects", () => {
      expectType<IOSchema>(z.union([z.object({}), z.object({})]));
      expectType<IOSchema>(z.object({}).or(z.object({})));
      expectType<IOSchema>(z.object({}).or(z.object({}).or(z.object({}))));
    });
    test("does not accept union of object and array of objects", () => {
      expectNotType<IOSchema>(z.object({}).or(z.array(z.object({}))));
    });
    test("accepts intersection of objects", () => {
      expectType<IOSchema>(z.intersection(z.object({}), z.object({})));
      expectType<IOSchema>(z.object({}).and(z.object({})));
      expectType<IOSchema>(z.object({}).and(z.object({}).and(z.object({}))));
    });
    test("does not accepts intersection of object with array of objects", () => {
      expectNotType<IOSchema>(z.object({}).and(z.array(z.object({}))));
    });
    test("accepts discriminated union of objects", () => {
      expectType<IOSchema>(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("one") }),
          z.object({ type: z.literal("two") }),
        ]),
      );
    });
    test("accepts a mix of types based on object", () => {
      expectType<IOSchema>(z.object({}).or(z.object({}).and(z.object({}))));
      expectType<IOSchema>(z.object({}).and(z.object({}).or(z.object({}))));
    });
    describe("Feature #600: Top level refinements", () => {
      test("Problem: refinement is indistinguishable from transformation", () => {
        // the issue has to be prevented programmatically using hasTopLevelTransformingEffect() helper
        expectType<IOSchema>(z.object({}).transform(() => []));
        expectType<IOSchema>(
          z.object({ s: z.string() }).transform(() => ({ n: 123 })),
        );
      });
      test("accepts a refinement of object", () => {
        expectType<IOSchema>(z.object({}).refine(() => true));
        expectType<IOSchema>(z.object({}).superRefine(() => true));
        expectType<IOSchema>(
          z.object({}).refinement(() => true, {
            code: "custom",
            message: "test",
          }),
        );
      });
      test("Issue 662: accepts nested refinements", () => {
        expectType<IOSchema>(
          z
            .object({})
            .refine(() => true)
            .refine(() => true),
        );
        expectType<IOSchema>(
          z
            .object({})
            .superRefine(() => true)
            .superRefine(() => true),
        );
      });
      test("does not accept transformation of object", () => {
        expectNotType<IOSchema>(z.object({}).transform(() => true));
      });
    });
  });

  describe("getFinalEndpointInputSchema()", () => {
    test("Should handle no middlewares", () => {
      const middlewares: AbstractMiddleware[] = [];
      const endpointInput = z.object({
        four: z.boolean(),
      });
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test("Should merge input object schemas", () => {
      const middlewares: AbstractMiddleware[] = [
        new Middleware({
          input: z.object({ one: z.string() }),
          handler: vi.fn(),
        }),
        new Middleware({
          input: z.object({ two: z.number() }),
          handler: vi.fn(),
        }),
        new Middleware({
          input: z.object({ three: z.null() }),
          handler: vi.fn(),
        }),
      ];
      const endpointInput = z.object({
        four: z.boolean(),
      });
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result).toBeInstanceOf(z.ZodIntersection);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test("Should merge union object schemas", () => {
      const middlewares: AbstractMiddleware[] = [
        new Middleware({
          input: z
            .object({ one: z.string() })
            .or(z.object({ two: z.number() })),
          handler: vi.fn(),
        }),
        new Middleware({
          input: z
            .object({ three: z.null() })
            .or(z.object({ four: z.boolean() })),
          handler: vi.fn(),
        }),
      ];
      const endpointInput = z
        .object({ five: z.string() })
        .or(z.object({ six: z.number() }));
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result).toBeInstanceOf(z.ZodIntersection);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test("Should merge intersection object schemas", () => {
      const middlewares: AbstractMiddleware[] = [
        new Middleware({
          input: z
            .object({ one: z.string() })
            .and(z.object({ two: z.number() })),
          handler: vi.fn(),
        }),
        new Middleware({
          input: z
            .object({ three: z.null() })
            .and(z.object({ four: z.boolean() })),
          handler: vi.fn(),
        }),
      ];
      const endpointInput = z
        .object({ five: z.string() })
        .and(z.object({ six: z.number() }));
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result).toBeInstanceOf(z.ZodIntersection);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test("Zod Issue #600: can not intersect object schema with passthrough and transformation", () => {
      // @see https://github.com/colinhacks/zod/issues/600
      // this is the reason why IOSchema is generic and middlewares have to be "strip"
      const left = z.object({}).passthrough();
      const right = z.object({
        id: z.string().transform((str) => parseInt(str)),
      });
      const schema = z.intersection(left, right);
      const result = schema.safeParse({
        id: "123",
      });
      expect(result.success).toBeFalsy();
      expect(result.error).toMatchSnapshot();
    });

    test("Should merge mixed object schemas", () => {
      const middlewares: AbstractMiddleware[] = [
        new Middleware({
          input: z
            .object({ one: z.string() })
            .and(z.object({ two: z.number() })),
          handler: vi.fn(),
        }),
        new Middleware({
          input: z
            .object({ three: z.null() })
            .or(z.object({ four: z.boolean() })),
          handler: vi.fn(),
        }),
      ];
      const endpointInput = z.object({
        five: z.string(),
      });
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result).toBeInstanceOf(z.ZodIntersection);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test("Should merge examples in case of using withMeta()", () => {
      const middlewares: AbstractMiddleware[] = [
        new Middleware({
          input: z
            .object({ one: z.string() })
            .and(z.object({ two: z.number() }))
            .example({ one: "test", two: 123 }),
          handler: vi.fn(),
        }),
        new Middleware({
          input: z
            .object({ three: z.null() })
            .or(z.object({ four: z.boolean() }))
            .example({ three: null, four: true }),
          handler: vi.fn(),
        }),
      ];
      const endpointInput = z
        .object({ five: z.string() })
        .example({ five: "some" });
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result._def[metaSymbol]?.examples).toEqual([
        {
          one: "test",
          two: 123,
          three: null,
          four: true,
          five: "some",
        },
      ]);
    });
  });
});
