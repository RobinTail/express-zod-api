import { ZodDateOut } from "../../src/date-out-schema";
import { describe, expect, test } from "vitest";

describe("ZodDateOut", () => {
  describe("static::create()", () => {
    test("should create an instance", () => {
      const schema = ZodDateOut.create();
      expect(schema).toBeInstanceOf(ZodDateOut);
      expect(schema._def.typeName).toEqual("ZodDateOut");
    });
  });

  describe("_parse()", () => {
    test("should handle wrong parsed type", () => {
      const schema = ZodDateOut.create();
      const result = schema.safeParse("12.01.2022");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "invalid_type",
            expected: "date",
            message: "Expected date, received string",
            path: [],
            received: "string",
          },
        ]);
      }
    });

    test("should accept valid date", () => {
      const schema = ZodDateOut.create();
      const result = schema.safeParse(new Date("2022-12-31"));
      expect(result).toEqual({
        success: true,
        data: "2022-12-31T00:00:00.000Z",
      });
    });

    test("should handle invalid date", () => {
      const schema = ZodDateOut.create();
      const result = schema.safeParse(new Date("2022-01-32"));
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
  });
});
