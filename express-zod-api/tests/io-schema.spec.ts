import { z } from "zod";
import { IOSchema, Middleware, ez } from "../src/index.ts";
import {
  extractObjectSchema,
  getFinalEndpointInputSchema,
} from "../src/io-schema.ts";
import { metaSymbol } from "../src/metadata.ts";
import { AbstractMiddleware } from "../src/middleware.ts";

describe("I/O Schema and related helpers", () => {
  describe("IOSchema", () => {
    test("accepts object", () => {
      expectTypeOf(z.object({})).toMatchTypeOf<IOSchema>();
      expectTypeOf(z.object({})).toMatchTypeOf<IOSchema<"strip">>();
      expectTypeOf(z.object({}).strict()).toMatchTypeOf<IOSchema<"strict">>();
      expectTypeOf(z.object({}).passthrough()).toMatchTypeOf<
        IOSchema<"passthrough">
      >();
      expectTypeOf(z.object({}).strip()).toMatchTypeOf<IOSchema<"strip">>();
    });
    test("accepts ez.raw()", () => {
      expectTypeOf(ez.raw()).toMatchTypeOf<IOSchema>();
      expectTypeOf(ez.raw({ something: z.any() })).toMatchTypeOf<IOSchema>();
    });
    test("respects the UnknownKeys type argument", () => {
      expectTypeOf(z.object({})).not.toMatchTypeOf<IOSchema<"passthrough">>();
    });
    test("accepts union of objects", () => {
      expectTypeOf(
        z.union([z.object({}), z.object({})]),
      ).toMatchTypeOf<IOSchema>();
      expectTypeOf(z.object({}).or(z.object({}))).toMatchTypeOf<IOSchema>();
      expectTypeOf(
        z.object({}).or(z.object({}).or(z.object({}))),
      ).toMatchTypeOf<IOSchema>();
    });
    test("does not accept union of object and array of objects", () => {
      expectTypeOf(
        z.object({}).or(z.array(z.object({}))),
      ).not.toMatchTypeOf<IOSchema>();
    });
    test("accepts intersection of objects", () => {
      expectTypeOf(
        z.intersection(z.object({}), z.object({})),
      ).toMatchTypeOf<IOSchema>();
      expectTypeOf(z.object({}).and(z.object({}))).toMatchTypeOf<IOSchema>();
      expectTypeOf(
        z.object({}).and(z.object({}).and(z.object({}))),
      ).toMatchTypeOf<IOSchema>();
    });
    test("does not accepts intersection of object with array of objects", () => {
      expectTypeOf(
        z.object({}).and(z.array(z.object({}))),
      ).not.toMatchTypeOf<IOSchema>();
    });
    test("accepts discriminated union of objects", () => {
      expectTypeOf(
        z.discriminatedUnion("type", [
          z.object({ type: z.literal("one") }),
          z.object({ type: z.literal("two") }),
        ]),
      ).toMatchTypeOf<IOSchema>();
    });
    test("accepts a mix of types based on object", () => {
      expectTypeOf(
        z.object({}).or(z.object({}).and(z.object({}))),
      ).toMatchTypeOf<IOSchema>();
      expectTypeOf(
        z.object({}).and(z.object({}).or(z.object({}))),
      ).toMatchTypeOf<IOSchema>();
    });
    describe("Feature #600: Top level refinements", () => {
      test("accepts a refinement of object", () => {
        expectTypeOf(z.object({}).refine(() => true)).toMatchTypeOf<IOSchema>();
        expectTypeOf(
          z.object({}).superRefine(() => true),
        ).toMatchTypeOf<IOSchema>();
        expectTypeOf(
          z.object({}).refinement(() => true, {
            code: "custom",
            message: "test",
          }),
        ).toMatchTypeOf<IOSchema>();
      });
      test("Issue 662: accepts nested refinements", () => {
        expectTypeOf(
          z
            .object({})
            .refine(() => true)
            .refine(() => true)
            .refine(() => true),
        ).toMatchTypeOf<IOSchema>();
        expectTypeOf(
          z
            .object({})
            .superRefine(() => true)
            .superRefine(() => true)
            .superRefine(() => true),
        ).toMatchTypeOf<IOSchema>();
      });
    });
    describe("Feature #1869: Top level transformations", () => {
      test("accepts transformations to another object", () => {
        expectTypeOf(
          z.object({ s: z.string() }).transform(() => ({ n: 123 })),
        ).toMatchTypeOf<IOSchema>();
      });
      test("accepts nested transformations", () => {
        expectTypeOf(
          z
            .object({ s: z.string() })
            .transform(() => ({ a: 123 }))
            .transform(() => ({ b: 456 }))
            .transform(() => ({ c: 789 })),
        ).toMatchTypeOf<IOSchema>();
      });
      test("accepts piping into another object schema", () => {
        expectTypeOf(
          z
            .object({ s: z.string() })
            .transform(() => ({ n: 123 }))
            .pipe(z.object({ n: z.number() })),
        ).toMatchTypeOf<IOSchema>();
        expectTypeOf(
          z.object({ user_id: z.string() }).remap({ user_id: "userId" }),
        ).toMatchTypeOf<IOSchema>();
      });
      test("does not accept transformation to another type", () => {
        expectTypeOf(
          z.object({}).transform(() => true),
        ).not.toMatchTypeOf<IOSchema>();
        expectTypeOf(
          z.object({}).transform(() => []),
        ).not.toMatchTypeOf<IOSchema>();
      });
      test("does not accept piping into another kind of schema", () => {
        expectTypeOf(
          z.object({ s: z.string() }).pipe(z.array(z.string())),
        ).not.toMatchTypeOf<IOSchema>();
      });
      test("does not accept nested piping", () => {
        expectTypeOf(
          z
            .object({ a: z.string() })
            .remap({ a: "b" })
            .pipe(z.object({ b: z.string() })),
        ).not.toMatchTypeOf<IOSchema>();
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
      expect(result).toMatchSnapshot();
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
});
