import { expectNotType, expectType } from "tsd";
import { IOSchema, createMiddleware, withMeta, z } from "../../src";
import { getFinalEndpointInputSchema } from "../../src/io-schema";
import { getMeta } from "../../src/metadata";
import { AnyMiddlewareDef } from "../../src/middleware";
import { serializeSchemaForTest } from "../helpers";

describe("I/O Schema and related helpers", () => {
  describe("IOSchema", () => {
    test("accepts object", () => {
      expectType<IOSchema>(z.object({}));
      expectType<IOSchema<"strip">>(z.object({}));
      expectType<IOSchema<"strict">>(z.object({}).strict());
      expectType<IOSchema<"passthrough">>(z.object({}).passthrough());
      expectType<IOSchema<"strip">>(z.object({}).strip());
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
        ])
      );
    });
    test("accepts a mix of types based on object", () => {
      expectType<IOSchema>(z.object({}).or(z.object({}).and(z.object({}))));
      expectType<IOSchema>(z.object({}).and(z.object({}).or(z.object({}))));
    });
    test("accepts a refinement of object", () => {
      expectType<IOSchema>(z.object({}).refine(() => true));
      expectType<IOSchema>(
        z.object({}).refinement(() => true, {
          code: "custom",
          message: "test",
        })
      );
    });
    test("does not accept transformation of object", () => {
      expectNotType<IOSchema>(z.object({}).transform(() => true));
    });
  });

  describe("getFinalEndpointInputSchema()", () => {
    test("Should handle no middlewares", () => {
      const middlewares: AnyMiddlewareDef[] = [];
      const endpointInput = z.object({
        four: z.boolean(),
      });
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result).toBeInstanceOf(z.ZodObject);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test("Should merge input object schemas", () => {
      const middlewares: AnyMiddlewareDef[] = [
        createMiddleware({
          input: z.object({
            one: z.string(),
          }),
          middleware: jest.fn(),
        }),
        createMiddleware({
          input: z.object({
            two: z.number(),
          }),
          middleware: jest.fn(),
        }),
        createMiddleware({
          input: z.object({
            three: z.null(),
          }),
          middleware: jest.fn(),
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
      const middlewares: AnyMiddlewareDef[] = [
        createMiddleware({
          input: z
            .object({
              one: z.string(),
            })
            .or(
              z.object({
                two: z.number(),
              })
            ),
          middleware: jest.fn(),
        }),
        createMiddleware({
          input: z
            .object({
              three: z.null(),
            })
            .or(
              z.object({
                four: z.boolean(),
              })
            ),
          middleware: jest.fn(),
        }),
      ];
      const endpointInput = z
        .object({
          five: z.string(),
        })
        .or(
          z.object({
            six: z.number(),
          })
        );
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result).toBeInstanceOf(z.ZodIntersection);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test("Should merge intersection object schemas", () => {
      const middlewares: AnyMiddlewareDef[] = [
        createMiddleware({
          input: z
            .object({
              one: z.string(),
            })
            .and(
              z.object({
                two: z.number(),
              })
            ),
          middleware: jest.fn(),
        }),
        createMiddleware({
          input: z
            .object({
              three: z.null(),
            })
            .and(
              z.object({
                four: z.boolean(),
              })
            ),
          middleware: jest.fn(),
        }),
      ];
      const endpointInput = z
        .object({
          five: z.string(),
        })
        .and(
          z.object({
            six: z.number(),
          })
        );
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(result).toBeInstanceOf(z.ZodIntersection);
      expect(serializeSchemaForTest(result)).toMatchSnapshot();
    });

    test("Should merge mixed object schemas", () => {
      const middlewares: AnyMiddlewareDef[] = [
        createMiddleware({
          input: z
            .object({
              one: z.string(),
            })
            .and(
              z.object({
                two: z.number(),
              })
            ),
          middleware: jest.fn(),
        }),
        createMiddleware({
          input: z
            .object({
              three: z.null(),
            })
            .or(
              z.object({
                four: z.boolean(),
              })
            ),
          middleware: jest.fn(),
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
      const middlewares: AnyMiddlewareDef[] = [
        createMiddleware({
          input: withMeta(
            z
              .object({
                one: z.string(),
              })
              .and(
                z.object({
                  two: z.number(),
                })
              )
          ).example({
            one: "test",
            two: 123,
          }),
          middleware: jest.fn(),
        }),
        createMiddleware({
          input: withMeta(
            z
              .object({
                three: z.null(),
              })
              .or(
                z.object({
                  four: z.boolean(),
                })
              )
          ).example({
            three: null,
            four: true,
          }),
          middleware: jest.fn(),
        }),
      ];
      const endpointInput = withMeta(
        z.object({
          five: z.string(),
        })
      ).example({
        five: "some",
      });
      const result = getFinalEndpointInputSchema(middlewares, endpointInput);
      expect(getMeta(result, "examples")).toEqual([
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
