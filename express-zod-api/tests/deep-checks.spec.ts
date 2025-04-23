import { UploadedFile } from "express-fileupload";
import { z } from "zod";
import type { $brand, $ZodType } from "@zod/core";
import { ez } from "../src";
import { hasNestedSchema } from "../src/deep-checks";
import { ezRegistry } from "../src/metadata";
import { ezUploadBrand } from "../src/upload-schema";

describe("Checks", () => {
  describe("hasNestedSchema()", () => {
    const condition = (subject: $ZodType) =>
      ezRegistry.get(subject)?.brand === ezUploadBrand;

    test("should return true for given argument satisfying condition", () => {
      expect(hasNestedSchema(ez.upload(), { condition })).toBeTruthy();
    });

    test.each([
      z.object({ test: ez.upload() }),
      ez.upload().or(z.boolean()),
      z.intersection(
        z.object({ test: z.boolean() }),
        z.object({ test2: ez.upload() }),
      ),
      z.optional(ez.upload()),
      ez.upload().nullable(),
      ez.upload().default({} as UploadedFile & $brand<symbol>),
      z.record(z.string(), ez.upload()),
      ez.upload().refine(() => true),
      z.array(ez.upload()),
    ])("should return true for wrapped needle %#", (subject) => {
      expect(hasNestedSchema(subject, { condition })).toBeTruthy();
    });

    test.each([
      z.object({}),
      z.any(),
      z.literal("test"),
      z.intersection(z.boolean(), z.literal(true)),
      z.number().or(z.string()),
    ])("should return false in other cases %#", (subject) => {
      expect(hasNestedSchema(subject, { condition })).toBeFalsy();
    });

    test("should finish early", () => {
      const subject = z.object({
        one: z.object({
          two: z.object({
            three: z.object({ four: z.number() }),
          }),
        }),
      });
      const check = vi.fn((schema) => schema instanceof z.ZodObject);
      hasNestedSchema(subject, {
        condition: check,
      });
      expect(check.mock.calls.length).toBe(1);
    });
  });
});
