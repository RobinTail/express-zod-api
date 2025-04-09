import { z } from "zod";
import { ez } from "../src";
import { metaSymbol } from "../src/metadata";
import { ezRawBrand } from "../src/raw-schema";

describe("ez.raw()", () => {
  describe("creation", () => {
    test("should be an instance of branded object", () => {
      const schema = ez.raw();
      expect(schema).toBeInstanceOf(z.ZodBranded);
      expect(schema._def[metaSymbol]?.brand).toBe(ezRawBrand);
    });
  });

  describe("types", () => {
    test("without extension", () => {
      const schema = ez.raw();
      expectTypeOf(schema._output).toExtend<{ raw: Buffer }>();
    });

    test("with empty extension", () => {
      const schema = ez.raw({});
      expectTypeOf(schema._output).toExtend<{ raw: Buffer }>();
    });

    test("with populated extension", () => {
      const schema = ez.raw({ extra: z.number() });
      expectTypeOf(schema._output).toExtend<{ raw: Buffer; extra: number }>();
    });
  });

  describe("parsing", () => {
    test("should accept buffer as the raw prop", () => {
      const schema = ez.raw();
      expect(schema.parse({ raw: Buffer.from("test"), extra: 123 })).toEqual({
        raw: expect.any(Buffer),
      });
    });

    test("should allow extension", () => {
      const schema = ez.raw({ extra: z.number() });
      expect(schema.parse({ raw: Buffer.from("test"), extra: 123 })).toEqual({
        raw: expect.any(Buffer),
        extra: 123,
      });
    });
  });
});
