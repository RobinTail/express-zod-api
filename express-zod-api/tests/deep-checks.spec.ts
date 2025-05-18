import { UploadedFile } from "express-fileupload";
import { globalRegistry, z } from "zod/v4";
import type { $brand, $ZodType } from "zod/v4/core";
import { ez } from "../src";
import { findNestedSchema, hasCycle } from "../src/deep-checks";
import { metaSymbol } from "../src/metadata";
import { ezUploadBrand } from "../src/upload-schema";

describe("Checks", () => {
  describe("findNestedSchema()", () => {
    const condition = (subject: $ZodType) =>
      globalRegistry.get(subject)?.[metaSymbol]?.brand === ezUploadBrand;

    test("should return true for given argument satisfying condition", () => {
      expect(
        findNestedSchema(ez.upload(), { condition, io: "input" }),
      ).toBeTruthy();
    });

    test.each([
      z.object({ test: ez.upload() }),
      ez.upload().or(z.boolean()),
      z.object({ test: z.boolean() }).and(z.object({ test2: ez.upload() })),
      z.optional(ez.upload()),
      ez.upload().nullable(),
      ez.upload().default({} as UploadedFile & $brand<symbol>),
      z.record(z.string(), ez.upload()),
      ez.upload().refine(() => true),
      z.array(ez.upload()),
    ])("should return true for wrapped needle %#", (subject) => {
      expect(
        findNestedSchema(subject, { condition, io: "input" }),
      ).toBeTruthy();
    });

    test.each([
      z.object({}),
      z.any(),
      z.literal("test"),
      z.boolean().and(z.literal(true)),
      z.number().or(z.string()),
    ])("should return false in other cases %#", (subject) => {
      expect(
        findNestedSchema(subject, { condition, io: "input" }),
      ).toBeUndefined();
    });

    test("should finish early (from bottom to top)", () => {
      const subject = z.object({
        one: z.object({
          two: z.object({
            three: z.object({ four: z.number() }),
          }),
        }),
      });
      const check = vi.fn((schema) => schema instanceof z.ZodNumber);
      findNestedSchema(subject, {
        condition: check,
        io: "input",
      });
      expect(check.mock.calls.length).toBe(1);
    });
  });

  describe("hasCycle()", () => {
    test.each(["input", "output"] as const)(
      "can find circular references %#",
      (io) => {
        const schema = z.object({
          name: z.string(),
          get features() {
            return schema.array();
          },
        });
        const result = hasCycle(schema, { io });
        expect(result).toBeTruthy();
      },
    );
  });
});
