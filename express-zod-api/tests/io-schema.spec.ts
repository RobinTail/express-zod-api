import { expectTypeOf } from "vitest";
import { z } from "zod/v4";
import { IOSchema, Middleware, ez } from "../src";
import { getFinalEndpointInputSchema } from "../src/io-schema";
import { AbstractMiddleware } from "../src/middleware";

describe("I/O Schema and related helpers", () => {
  describe("IOSchema", () => {
    test("accepts object", () => {
      expectTypeOf(z.object({})).toExtend<IOSchema>();
      expectTypeOf(z.object({}).strip()).toExtend<IOSchema>();
      expectTypeOf(z.object({}).strict()).toExtend<IOSchema>();
      expectTypeOf(z.object({}).loose()).toExtend<IOSchema>();
    });
    test("accepts ez.raw()", () => {
      expectTypeOf(ez.raw()).toExtend<IOSchema>();
      expectTypeOf(ez.raw({ something: z.any() })).toExtend<IOSchema>();
    });
    test("accepts ez.form()", () => {
      expectTypeOf(ez.form({})).toExtend<IOSchema>();
    });
    test("accepts union of objects", () => {
      expectTypeOf(z.union([z.object({}), z.object({})])).toExtend<IOSchema>();
      expectTypeOf(z.object({}).or(z.object({}))).toExtend<IOSchema>();
      expectTypeOf(
        z.object({}).or(z.object({}).or(z.object({}))),
      ).toExtend<IOSchema>();
    });
    test("does not accept union of object and array of objects", () => {
      expectTypeOf(
        z.object({}).or(z.array(z.object({}))),
      ).not.toExtend<IOSchema>();
    });
    test("accepts intersection of objects", () => {
      expectTypeOf(z.object({}).and(z.object({}))).toExtend<IOSchema>();
      expectTypeOf(z.object({}).and(z.object({}))).toExtend<IOSchema>();
      expectTypeOf(
        z.object({}).and(z.object({})).and(z.object({})),
      ).toExtend<IOSchema>();
    });
    test("does not accepts intersection of object with array of objects", () => {
      expectTypeOf(
        z.object({}).and(z.array(z.object({}))),
      ).not.toExtend<IOSchema>();
    });
    test("accepts discriminated union of objects", () => {
      expectTypeOf(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("one") }),
          z.object({ type: z.literal("two") }),
        ]),
      ).toExtend<IOSchema>();
    });
    test("accepts a mix of types based on object", () => {
      expectTypeOf(
        z.object({}).or(z.object({}).and(z.object({}))),
      ).toExtend<IOSchema>();
      expectTypeOf(
        z.object({}).and(z.object({}).or(z.object({}))),
      ).toExtend<IOSchema>();
    });
    describe("Feature #600: Top level refinements", () => {
      test("accepts a refinement of object", () => {
        expectTypeOf(z.object({}).refine(() => true)).toExtend<IOSchema>();
        expectTypeOf(z.object({}).check(() => void 0)).toExtend<IOSchema>();
        expectTypeOf(
          z.object({}).refine(() => true, { error: "test" }),
        ).toExtend<IOSchema>();
      });
      test("Issue 662: accepts nested refinements", () => {
        expectTypeOf(
          z
            .object({})
            .refine(() => true)
            .refine(() => true)
            .refine(() => true),
        ).toExtend<IOSchema>();
        expectTypeOf(
          z
            .object({})
            .check(() => void 0)
            .check(() => void 0)
            .check(() => void 0),
        ).toExtend<IOSchema>();
      });
    });
    describe("Feature #1869: Top level transformations", () => {
      test("accepts transformations to another object", () => {
        expectTypeOf(
          z.object({ s: z.string() }).transform(() => ({ n: 123 })),
        ).toExtend<IOSchema>();
      });
      test("accepts nested transformations", () => {
        expectTypeOf(
          z
            .object({ s: z.string() })
            .transform(() => ({ a: 123 }))
            .transform(() => ({ b: 456 }))
            .transform(() => ({ c: 789 })),
        ).toExtend<IOSchema>();
      });
      test("accepts piping into another object schema", () => {
        expectTypeOf(
          z
            .object({ s: z.string() })
            .transform(() => ({ n: 123 }))
            .pipe(z.object({ n: z.number() })),
        ).toExtend<IOSchema>();
        expectTypeOf(
          z.object({ user_id: z.string() }).remap({ user_id: "userId" }),
        ).toExtend<IOSchema>();
      });
      test("does not accept transformation to another type", () => {
        expectTypeOf(
          z.object({}).transform(() => true),
        ).not.toExtend<IOSchema>();
        expectTypeOf(z.object({}).transform(String)).not.toExtend<IOSchema>();
        expectTypeOf(z.object({}).transform(() => [])).not.toExtend<IOSchema>();
      });
      test("does not accept piping into another kind of schema", () => {
        expectTypeOf(z.unknown().pipe(z.string())).not.toExtend<IOSchema>();
        expectTypeOf(
          z
            .object({ s: z.string() })
            .transform(Object.values)
            .pipe(z.array(z.string())),
        ).not.toExtend<IOSchema>();
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
      expect(result).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
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
      expect(result).toMatchSnapshot();
    });

    test("Zod Issue #600: can not intersect object schema with passthrough and transformation", () => {
      // @see https://github.com/colinhacks/zod/issues/600
      // Limitation: IOSchema in middlewares must be of "strip" kind
      const left = z.looseObject({});
      const right = z.object({
        id: z.string().transform((str) => parseInt(str)),
      });
      const schema = left.and(right);
      expect(() => schema.parse({ id: "123" })).toThrowErrorMatchingSnapshot();
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
      expect(result).toMatchSnapshot();
    });

    test("Should merge examples", () => {
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
      expect(result.meta()?.examples).toEqual([
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
