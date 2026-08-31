import createHttpError from "http-errors";
import * as R from "ramda";
import { z } from "zod";
import { createRequire } from "node:module";
import { METHODS } from "node:http";

describe("Environment checks", () => {
  describe("Zod global registry", () => {
    test("is shared across both of its ESM and CJS packages", () => {
      createRequire(import.meta.url)("zod");
      const { globalRegistry } = createRequire(import.meta.url)("zod");
      expect(globalRegistry).toBe(z.globalRegistry);
    });
  });

  describe("Zod Dates", () => {
    test.each(["2021-01-32", "22/01/2022", "2021-01-31T25:00:00.000Z"])(
      "should detect invalid date %#",
      (str) => {
        expect(z.validate(z.date(), new Date(str))).toBeFalsy();
        expect(z.validate(z.string().date(), str)).toBeFalsy();
        expect(z.validate(z.string().datetime(), str)).toBeFalsy();
        expect(z.validate(z.iso.date(), str)).toBeFalsy();
        expect(z.validate(z.iso.datetime(), str)).toBeFalsy();
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

    test("both z.enum() and z.literal() can be empty", () => {
      expect(z.enum([])._zod.def.entries).toEqual({});
      /** @since 4.5.0 https://github.com/colinhacks/zod/pull/6459, 4.0.9 — 4.3.4 throws */
      expect(z.literal([])._zod.def.values).toEqual([]);
    });

    test.each([z.coerce.number(), z.preprocess(Number, z.number())])(
      "z.coerce and z.preprocess have no effect on JSON schema depiction %#",
      (schema) => {
        expect(schema.toJSONSchema()).toMatchSnapshot();
      },
    );
  });

  describe("Zod new features", () => {
    test("Codecs can be reversed", () => {
      const schema = z.codec(z.iso.datetime(), z.date(), {
        decode: (str) => new Date(str),
        encode: (date) => date.toISOString(),
      });
      const reversed = z.invertCodec(schema);
      expect(reversed.parse(new Date("2022-01-01T00:00:00.000Z"))).toBe(
        "2022-01-01T00:00:00.000Z",
      );
    });

    test("Codec strictly typed methods still validate inputs in runtime", () => {
      const schema = z.codec(z.string(), z.number(), {
        decode: Number,
        encode: String,
      });
      expect(() => schema.decode(true as unknown as string)).toThrow(
        /expected string, received boolean/,
      );
      expect(() => schema.encode(false as unknown as number)).toThrow(
        /expected number, received boolean/,
      );
    });

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

    test("metadata is inheritable since zod 4.3.0", () => {
      const parent = z.string().meta({ one: "test" });
      const subject = parent.min(1).meta({ two: "another" });
      expect(subject.meta()).toHaveProperty("one", "test");
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
      expect(schema._zod.def.shape.three._zod.optin).toBe("defaulted"); // @since 4.5.0
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

    test("nullable depicted as multitype", () => {
      expect(z.string().nullable().toJSONSchema().type).toEqual([
        "string",
        "null",
      ]);
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

    test("meta id does NOT go into depiction", () => {
      expect(
        z.toJSONSchema(z.string().meta({ id: "uniq" })),
      ).not.toHaveProperty("id");
    });

    /**
     * @link https://github.com/colinhacks/zod/commit/adf65cdef4d8de10b788293808e8d52807adb7c0
     * @since zod v4.3.0, 29.12.2025
     * */
    test("meta id uniqueness is NOT checked", () => {
      const id = "Shared";
      const alpha = z.string().meta({ id });
      let beta: z.ZodType;
      expect(() => {
        beta = z.number().meta({ id });
      }).not.toThrow();
      const metaAlpha = z.globalRegistry.get(alpha)!;
      const metaBeta = z.globalRegistry.get(beta!)!;
      expect(metaAlpha).toBeTruthy();
      expect(metaBeta).toBeTruthy();
      expect(metaAlpha.id).toBe(metaBeta.id);
    });

    test("depicting intersection of objects is a flat object", () => {
      const c = z.object({ a: z.string() }).and(z.object({ b: z.string() }));
      expect(c.toJSONSchema()).not.toHaveProperty("allOf"); // @since 4.5.0
    });

    // @todo require zod 4.5 and use compiled schemas everywhere
    test("compiled schemas have identical shape", () => {
      const schema = z.iso.date();
      expect(Object.keys(z.compile(schema))).toEqual(Object.keys(schema));
    });
  });

  describe("Node.js HTTP method support", () => {
    test("should include QUERY in http.METHODS", () => {
      expect(METHODS).toContain("QUERY");
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
