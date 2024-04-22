import { z } from "zod";
import { getMeta } from "../../src/metadata";
import { ez } from "../../src";
import { describe, expect, test } from "vitest";

describe("ez.dateIn()", () => {
  describe("creation", () => {
    test("should create an instance", () => {
      const schema = ez.dateIn();
      expect(schema).toBeInstanceOf(z.ZodPipeline);
      expect(getMeta(schema, "kind")).toEqual("DateIn");
    });
  });

  describe("parsing", () => {
    test("should handle wrong parsed type", () => {
      const schema = ez.dateIn();
      const result = schema.safeParse(123);
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot();
      }
    });

    test.each([
      "2022-12-31T00:00:00.000Z",
      "2022-12-31T00:00:00.0Z",
      "2022-12-31T00:00:00Z",
      "2022-12-31T00:00:00",
      "2022-12-31",
    ])("should accept valid date string %#", (subject) => {
      const schema = ez.dateIn();
      const result = schema.safeParse(subject);
      expect(result).toEqual({
        success: true,
        data: new Date(subject),
      });
    });

    test("should handle invalid date", () => {
      const schema = ez.dateIn();
      const result = schema.safeParse("2022-01-32");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot();
      }
    });

    test("should handle invalid format", () => {
      const schema = ez.dateIn();
      const result = schema.safeParse("12.01.2021");
      expect(result.success).toBeFalsy();
      if (!result.success) {
        expect(result.error.issues).toMatchSnapshot();
      }
    });
  });
});
