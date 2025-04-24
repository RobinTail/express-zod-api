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

  /**
   * @todo try z.int().max(1000) when it's fixed in Zod 4
   * @link https://github.com/colinhacks/zod/issues/4162
   */
  describe("Zod checks/refinements", () => {
    test.each([
      z.string().email(),
      z.email(),
      z.number().int(),
      z.int(),
      z.int32(),
    ])("Snapshot control $constructor.name definition", (schema) => {
      const snapshot = R.omit(["id", "version"], schema._zod);
      expect(snapshot).toMatchSnapshot();
    });

    /**
     * @link https://github.com/colinhacks/zod/issues/4162
     * @link https://github.com/colinhacks/zod/issues/4141
     * */
    test("This should fail when they fix it", () => {
      expect(z.int()).not.toHaveProperty("max");
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

    /** now input examples are broken */
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
  });

  describe("Zod new features", () => {
    test("interface shape does not contain question marks, but there is a list of them", () => {
      const schema = z.interface({
        one: z.boolean(),
        "two?": z.boolean(),
      });
      expect(Object.keys(schema._zod.def.shape)).toEqual(["one", "two"]);
      expect(schema._zod.def.optional).toEqual(["two"]);
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
