import { z } from "zod/v4";
import { ez } from "../src";
import { ezFormBrand } from "../src/form-schema";
import { getBrand } from "../src/metadata";

describe("ez.form()", () => {
  describe("creation", () => {
    test.each([{ name: z.string() }, z.object({ name: z.string() })])(
      "should create a branded object instance based on the argument %#",
      (base) => {
        const schema = ez.form(base);
        expect(schema).toBeInstanceOf(z.ZodObject);
        expect(getBrand(schema)).toBe(ezFormBrand);
        expect(schema._zod.def.shape).toHaveProperty(
          "name",
          expect.any(z.ZodString),
        );
      },
    );
  });

  describe("parsing", () => {
    test("should accept the object of exact shape", () => {
      const schema = ez.form({ name: z.string() });
      expect(schema.parse({ name: "test", extra: "removed" })).toEqual({
        name: "test",
      });
    });

    test("should accept extras when the base has .passthrough()", () => {
      const schema = ez.form(z.object({ name: z.string() }).loose());
      expect(schema.parse({ name: "test", extra: "kept" })).toEqual({
        name: "test",
        extra: "kept",
      });
    });

    test("should throw for missing props as a regular object schema", () => {
      const schema = ez.form({ name: z.string() });
      expect(() =>
        schema.parse({ wrong: "removed" }),
      ).toThrowErrorMatchingSnapshot();
    });
  });
});
