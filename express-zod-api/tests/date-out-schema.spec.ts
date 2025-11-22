import { z } from "zod";
import { ezDateOutBrand } from "../src/date-out-schema.ts";
import { ez } from "../src/index.ts";
import { getBrand } from "@express-zod-api/zod-plugin";

describe("ez.dateOut()", () => {
  describe("creation", () => {
    test("should create an instance", () => {
      const schema = ez.dateOut();
      expect(schema).toBeInstanceOf(z.ZodPipe);
      expect(getBrand(schema)).toBe(ezDateOutBrand);
    });
  });

  describe("parsing", () => {
    test("should handle wrong parsed type", () => {
      const schema = ez.dateOut();
      const result = schema.safeParse("12.01.2022");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "invalid_type",
            expected: "date",
            message: "Invalid input: expected date, received string",
            path: [],
          },
        ]);
      }
    });

    test("should accept valid date", () => {
      const schema = ez.dateOut();
      const result = schema.safeParse(new Date("2022-12-31"));
      expect(result).toEqual({
        success: true,
        data: "2022-12-31T00:00:00.000Z",
      });
    });

    test("should handle invalid date", () => {
      const schema = ez.dateOut();
      const result = schema.safeParse(new Date("2022-01-32"));
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toEqual([
          {
            code: "invalid_type",
            expected: "date",
            message: "Invalid input: expected date, received Date",
            path: [],
            received: "Invalid Date",
          },
        ]);
      }
    });
  });
});
