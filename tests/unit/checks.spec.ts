import { UploadedFile } from "express-fileupload";
import { describe, expect, test } from "vitest";
import { z } from "zod";
import { ez } from "../../src";
import {
  hasNestedSchema,
  hasTopLevelTransformingEffect,
} from "../../src/checks";
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
      let callCount = 0;
      hasNestedSchema({
        subject,
        condition: (schema) => {
          callCount++;
          return schema instanceof z.ZodObject;
        },
      });
      expect(callCount).toBe(1);
    });
  });

  describe("hasTopLevelTransformingEffect()", () => {
    test("should return true for transformation", () => {
      expect(
        hasTopLevelTransformingEffect(z.object({}).transform(() => [])),
      ).toBeTruthy();
    });

    test("should detect transformation in intersection", () => {
      expect(
        hasTopLevelTransformingEffect(
          z.object({}).and(z.object({}).transform(() => [])),
        ),
      ).toBeTruthy();
    });

    test("should detect transformation in union", () => {
      expect(
        hasTopLevelTransformingEffect(
          z.object({}).or(z.object({}).transform(() => [])),
        ),
      ).toBeTruthy();
    });

    test("should return false for object fields using transformations", () => {
      expect(
        hasTopLevelTransformingEffect(
          z.object({ s: z.string().transform(() => 123) }),
        ),
      ).toBeFalsy();
    });

    test("should return false for refinement", () => {
      expect(
        hasTopLevelTransformingEffect(z.object({}).refine(() => true)),
      ).toBeFalsy();
    });
  });
});
