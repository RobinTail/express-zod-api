import { readFile } from "node:fs/promises";
import { z, $brand } from "zod/v4";
import { ez } from "../src";

describe("ez.buffer()", () => {
  describe("creation", () => {
    test("should create a Buffer", () => {
      const schema = ez.buffer();
      expect(schema).toBeInstanceOf(z.ZodCustom);
      expectTypeOf<z.output<typeof schema>>().toEqualTypeOf<
        Buffer & $brand<symbol>
      >();
    });
  });

  describe("parsing", () => {
    test("should invalidate wrong types", () => {
      const result = ez.buffer().safeParse("123");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          { code: "custom", message: "Expected Buffer", path: [] },
        ]);
      }
    });

    test("should accept Buffer", () => {
      const schema = ez.buffer();
      const subject = Buffer.from("test", "utf-8");
      const result = schema.safeParse(subject);
      expect(result).toEqual({ success: true, data: subject });
    });

    test("should accept data read into buffer", async () => {
      const schema = ez.buffer();
      const data = await readFile("../logo.svg");
      const result = schema.safeParse(data);
      expect(result).toEqual({ success: true, data });
    });
  });
});
