import { z } from "zod";
import { pack, unpack } from "../src/index.ts";

describe("Packer", () => {
  describe("pack()", () => {
    test("should add the bag to the schema", () => {
      const schema = pack(z.string(), { one: "test", two: 123 });
      expect(schema._zod.bag).toEqual({ one: "test", two: 123 });
      expectTypeOf(schema._zod.bag).toExtend<{ one: string; two: number }>();
    });

    test("respects other bag properties", () => {
      const schema = pack(z.string().min(2), { one: "test", two: 123 }).max(5);
      expect(schema._zod.bag).toEqual({
        one: "test",
        two: 123,
        minimum: 2,
        maximum: 5,
      });
    });

    test("called multiples times merges the bag with last write priority", () => {
      const s1 = pack(z.string(), { a: 1, b: 1 });
      const s2 = pack(s1, { b: 2, c: 3 });
      expect(s2._zod.bag).toMatchObject({ a: 1, b: 2, c: 3 });
    });

    test("does not change parse() method behavior", () => {
      const base = z.string().min(2);
      const packed = pack(base, { tag: "x" });
      expect(() => packed.parse("x")).toThrow(); // still fails min(2)
      expect(packed.parse("ok")).toBe("ok");
    });
  });

  describe("unpack()", () => {
    test("should return the bag from the schema", () => {
      const subject = pack(z.string(), { one: "test", two: 123 });
      expect(unpack(subject)).toMatchObject({ one: "test", two: 123 });
      expectTypeOf(unpack(subject)).toExtend<{ one: string; two: number }>();
    });
  });
});
