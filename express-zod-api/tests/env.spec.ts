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
      const snapshot = R.omit(["version"], schema._zod);
      expect(snapshot).toMatchSnapshot();
    });
  });

  describe("Zod imperfections", () => {
    test("discriminated unions are not depicted well", () => {
      expect(
        z.toJSONSchema(
          z.discriminatedUnion("status", [
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
      const json = z.toJSONSchema(z.bigint(), { unrepresentable: "any" });
      expect(R.omit(["$schema"], json)).toEqual({});
    });

    test("circular object schema has a getter since 4.0.15", () => {
      const schema = z.object({
        name: z.string(),
        get features() {
          return schema.array();
        },
      });
      expect(
        Object.getOwnPropertyDescriptors(schema._zod.def.shape).features,
      ).toHaveProperty("get", expect.any(Function));
    });

    test("ZodError inequality", () => {
      const issue: z.core.$ZodIssue = {
        code: "invalid_type",
        expected: "string",
        input: 123,
        path: [],
        message: "expected string, received number",
      };
      const error = new z.ZodError([issue]);
      const real = new z.ZodRealError([issue]);
      expect(error).not.toBeInstanceOf(Error); // and this is important
      expect(real).toBeInstanceOf(Error);
      expect(real).toBeInstanceOf(z.ZodError); // important inheritance
      expect(error).toHaveProperty("message");
      expect(real).toHaveProperty("message");
    });
  });

  describe("Zod new features", () => {
    test("ZodError equality", () => {
      try {
        z.number().parse("test");
      } catch (caught) {
        const returned = z.number().safeParse("test").error;
        expect(returned).toEqual(caught);
        expect(returned).toBeInstanceOf(z.ZodError);
        expect(caught).toBeInstanceOf(z.ZodError);
        expect(returned).toBeInstanceOf(Error);
        expect(caught).toBeInstanceOf(Error);
      }
    });

    test("meta() merge, not just overrides", () => {
      const schema = z
        .string()
        .meta({ examples: ["test"] })
        .describe("some")
        .meta({ title: "last" });
      expect(schema.meta()).toMatchSnapshot();
    });

    test("object shape conveys the keys optionality", () => {
      const schema = z.object({
        one: z.boolean(),
        two: z.boolean().optional(),
        three: z.boolean().default(true),
        four: z
          .boolean()
          .optional()
          .transform(() => false),
      });
      expect(Object.keys(schema._zod.def.shape)).toEqual([
        "one",
        "two",
        "three",
        "four",
      ]);
      expect(schema._zod.def.shape.one._zod.optin).toBeUndefined();
      expect(schema._zod.def.shape.one._zod.optout).toBeUndefined();
      expect(schema._zod.def.shape.two._zod.optin).toBe("optional");
      expect(schema._zod.def.shape.two._zod.optout).toBe("optional");
      expect(schema._zod.def.shape.three._zod.optin).toBe("optional");
      expect(schema._zod.def.shape.three._zod.optout).toBe(undefined);
      expect(schema._zod.def.shape.four._zod.optin).toBe("optional");
      expect(schema._zod.def.shape.four._zod.optout).toBe(undefined);
      expectTypeOf<z.input<typeof schema>>().toEqualTypeOf<{
        one: boolean;
        two?: boolean | undefined;
        three?: boolean | undefined;
        four?: boolean | undefined;
      }>();
      expectTypeOf<z.output<typeof schema>>().toEqualTypeOf<{
        one: boolean;
        two?: boolean | undefined;
        three: boolean;
        four: boolean;
      }>();
    });

    test("coerce is safe for nullable and optional", () => {
      const boolSchema = z.coerce.boolean();
      expect(boolSchema.isOptional()).toBeTruthy();
      expect(boolSchema.isNullable()).toBeTruthy();
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

    test("meta id goes directly to depiction", () => {
      expect(z.toJSONSchema(z.string().meta({ id: "uniq" }))).toMatchSnapshot();
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
