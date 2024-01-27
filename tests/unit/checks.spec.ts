import { UploadedFile } from "express-fileupload";
import { describe, expect, test, vi } from "vitest";
import { z } from "zod";
import { ez } from "../../src";
import { hasNestedSchema, hasTranformationOnTop } from "../../src/checks";
import { isProprietary } from "../../src/metadata";
import { ezUploadKind } from "../../src/upload-schema";

describe("Checks", () => {
  describe("hasNestedSchema()", () => {
    const condition = (subject: z.ZodTypeAny) =>
      isProprietary(subject, ezUploadKind);

    test("should return true for given argument satisfying condition", () => {
      expect(hasNestedSchema({ subject: ez.upload(), condition })).toBeTruthy();
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
      expect(hasNestedSchema({ subject, condition })).toBeTruthy();
    });

    test.each([
      z.object({}),
      z.any(),
      z.literal("test"),
      z.boolean().and(z.literal(true)),
      z.number().or(z.string()),
    ])("should return false in other cases %#", (subject) => {
      expect(hasNestedSchema({ subject, condition })).toBeFalsy();
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
      hasNestedSchema({
        subject,
        condition: check,
      });
      expect(check.mock.calls.length).toBe(1);
    });
  });

  describe("hasTranformationOnTop()", () => {
    test("should return true for transformation", () => {
      expect(
        hasTranformationOnTop(z.object({}).transform(() => [])),
      ).toBeTruthy();
    });

    test("should detect transformation in intersection", () => {
      expect(
        hasTranformationOnTop(
          z.object({}).and(z.object({}).transform(() => [])),
        ),
      ).toBeTruthy();
    });

    test("should detect transformation in union", () => {
      expect(
        hasTranformationOnTop(
          z.object({}).or(z.object({}).transform(() => [])),
        ),
      ).toBeTruthy();
    });

    test("should return false for object fields using transformations", () => {
      expect(
        hasTranformationOnTop(z.object({ s: z.string().transform(() => 123) })),
      ).toBeFalsy();
    });

    test("should return false for refinement", () => {
      expect(
        hasTranformationOnTop(z.object({}).refine(() => true)),
      ).toBeFalsy();
    });
  });
});
