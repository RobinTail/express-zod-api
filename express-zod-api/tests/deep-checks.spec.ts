import { UploadedFile } from "express-fileupload";
import { z } from "zod";
import { ez } from "../src/index.ts";
import { hasNestedSchema } from "../src/deep-checks.ts";
import { metaSymbol } from "../src/metadata.ts";
import { ezUploadBrand } from "../src/upload-schema.ts";

describe("Checks", () => {
  describe("hasNestedSchema()", () => {
    const condition = (subject: z.ZodTypeAny) =>
      subject._def[metaSymbol]?.brand === ezUploadBrand;

    test("should return true for given argument satisfying condition", () => {
      expect(hasNestedSchema(ez.upload(), { condition })).toBeTruthy();
    });

    test.each([
      z.object({ test: ez.upload() }),
      ez.upload().or(z.boolean()),
      z.object({ test: z.boolean() }).and(z.object({ test2: ez.upload() })),
      z.optional(ez.upload()),
      ez.upload().nullable(),
      ez.upload().default({} as UploadedFile),
      z.record(ez.upload()),
      ez.upload().refine(() => true),
      z.array(ez.upload()),
    ])("should return true for wrapped needle %#", (subject) => {
      expect(hasNestedSchema(subject, { condition })).toBeTruthy();
    });

    test.each([
      z.object({}),
      z.any(),
      z.literal("test"),
      z.boolean().and(z.literal(true)),
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
