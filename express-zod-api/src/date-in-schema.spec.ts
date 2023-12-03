import { ZodDateIn } from "./date-in-schema";

describe("ZodDateIn", () => {
  describe("static::create()", () => {
    test("should create an instance", () => {
      const schema = ZodDateIn.create();
      expect(schema).toBeInstanceOf(ZodDateIn);
      expect(schema._def.typeName).toEqual("ZodDateIn");
    });
  });

  describe("_parse()", () => {
    test("should handle wrong parsed type", () => {
      const schema = ZodDateIn.create();
      const result = schema.safeParse(123);
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "invalid_type",
            expected: "string",
            message: "Expected string, received number",
            path: [],
            received: "number",
          },
        ]);
      }
    });

    test("should accept valid date string", () => {
      const schema = ZodDateIn.create();
      const result = schema.safeParse("2022-12-31");
      expect(result).toEqual({
        success: true,
        data: new Date("2022-12-31"),
      });
    });

    test("should handle invalid date", () => {
      const schema = ZodDateIn.create();
      const result = schema.safeParse("2022-01-32");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "invalid_date",
            message: "Invalid date",
            path: [],
          },
        ]);
      }
    });

    test("should handle invalid format", () => {
      const schema = ZodDateIn.create();
      const result = schema.safeParse("12.01.2021");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "invalid_string",
            message: "Invalid",
            validation: "regex",
            path: [],
          },
        ]);
      }
    });
  });
});
