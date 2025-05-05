import createHttpError from "http-errors";
import * as R from "ramda";
import { z } from "zod";

describe("Environment checks", () => {
  describe("Zod Dates", () => {
    test.each(["2021-01-32", "22/01/2022", "2021-01-31T25:00:00.000Z"])(
      "should detect invalid date %#",
      (str) => {
        expect(z.date().safeParse(new Date(str)).success).toBeFalsy();
        expect(z.string().date().safeParse(str).success).toBeFalsy();
        expect(z.string().datetime().safeParse(str).success).toBeFalsy();
        expect(z.iso.date().safeParse(str).success).toBeFalsy();
        expect(z.iso.datetime().safeParse(str).success).toBeFalsy();
      },
    );
  });

  describe("Zod checks/refinements", () => {
    test.each([
      z.string().email(),
      z.email(),
      z.number().int(),
      z.int(),
      z.int32(),
      z.int().max(1000),
    ])("Snapshot control $constructor.name definition", (schema) => {
      const snapshot = R.omit(["id", "version"], schema._zod);
      expect(snapshot).toMatchSnapshot();
    });
  });

  describe("Zod imperfections", () => {
    test("discriminated unions are not depicted well", () => {
      expect(
        z.toJSONSchema(
          z.discriminatedUnion([
            z.object({ status: z.literal("success"), data: z.any() }),
            z.object({
              status: z.literal("error"),
              error: z.object({ message: z.string() }),
            }),
          ]),
        ),
      ).not.toHaveProperty("discriminator");
    });

    test("bigint is not representable", () => {
      expect(z.toJSONSchema(z.bigint(), { unrepresentable: "any" })).toEqual(
        {},
      );
    });

    /** @link https://github.com/colinhacks/zod/issues/4274 */
    test.each(["input", "output"] as const)(
      "%s examples of transformations",
      (io) => {
        const schema = z
          .string()
          .meta({ examples: ["test"] })
          .transform(Number)
          .meta({ examples: [4] });
        expect(
          z.toJSONSchema(schema, { io, unrepresentable: "any" }),
        ).toMatchSnapshot();
      },
    );

    test("meta overrides, does not merge", () => {
      const schema = z
        .string()
        .meta({ examples: ["test"] })
        .meta({ description: "some" })
        .meta({ title: "last" });
      expect(schema.meta()).toMatchSnapshot();
    });

    test("circular object schema has no sign of getter in its shape", () => {
      const schema = z.object({
        name: z.string(),
        get features() {
          return schema.array();
        },
      });
      expect(
        Object.getOwnPropertyDescriptors(schema._zod.def.shape),
      ).toMatchSnapshot();
    });
  });

  describe("Zod new features", () => {
    test("retention: object shape conveys the keys optionality", () => {
      const schema = z.object({
        one: z.boolean(),
        two: z.boolean().optional(),
      });
      expect(Object.keys(schema._zod.def.shape)).toEqual(["one", "two"]);
      expect(schema._zod.def.shape.one).toBeInstanceOf(z.ZodBoolean);
      expect(schema._zod.def.shape.two).toBeInstanceOf(z.ZodOptional);
      expect(schema._zod.def.shape.two.isOptional()).toBe(true);
    });

    test("coerce is safe for nullable and optional", () => {
      const boolSchema = z.coerce.boolean();
      expect(boolSchema.isOptional()).toBeTruthy();
      expect(boolSchema.isNullable()).toBeTruthy();
    });
  });

  describe("Vitest error comparison", () => {
    test("should distinguish error instances of different classes", () => {
      expect(createHttpError(500, "some message")).not.toEqual(
        new Error("some message"),
      );
    });

    test("should distinguish HTTP errors by status code and message", () => {
      expect(createHttpError(400, "test")).not.toEqual(
        createHttpError(500, "test"),
      );
      expect(createHttpError(400, "one")).not.toEqual(
        createHttpError(400, "two"),
      );
      expect(createHttpError(400, new Error("one"))).not.toEqual(
        createHttpError(400, new Error("two")),
      );
    });

    test("should distinguish error causes", () => {
      expect(new Error("test", { cause: "one" })).not.toEqual(
        new Error("test", { cause: "two" }),
      );
      expect(
        createHttpError(400, new Error("test", { cause: "one" })),
      ).not.toEqual(createHttpError(400, new Error("test", { cause: "two" })));
    });
  });
});
