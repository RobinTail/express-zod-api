import { bench, describe } from "vitest";
import { z } from "zod";
import { ez } from "../../src";
import { hasNestedSchema } from "../../src/checks";
import { isProprietary } from "../../src/metadata";
import { ezUploadKind } from "../../src/upload-schema";

describe("Experiment", () => {
  const testedSchema = z
    .object({ test: z.boolean() })
    .and(z.object({ test2: ez.upload() }));
  const testedCondition = (subject: z.ZodTypeAny) =>
    isProprietary(subject, ezUploadKind);

  const originalFn = ({
    subject,
    condition,
    maxDepth,
    depth = 1,
  }: {
    subject: z.ZodTypeAny;
    condition: (schema: z.ZodTypeAny) => boolean;
    maxDepth?: number;
    depth?: number;
  }): boolean => {
    if (condition(subject)) {
      return true;
    }
    if (maxDepth !== undefined && depth >= maxDepth) {
      return false;
    }
    const common = { condition, maxDepth, depth: depth + 1 };
    if (subject instanceof z.ZodObject) {
      return Object.values<z.ZodTypeAny>(subject.shape).some((entry) =>
        originalFn({ subject: entry, ...common }),
      );
    }
    if (subject instanceof z.ZodUnion) {
      return subject.options.some((entry: z.ZodTypeAny) =>
        originalFn({ subject: entry, ...common }),
      );
    }
    if (subject instanceof z.ZodIntersection) {
      return [subject._def.left, subject._def.right].some((entry) =>
        originalFn({ subject: entry, ...common }),
      );
    }
    if (subject instanceof z.ZodOptional || subject instanceof z.ZodNullable) {
      return originalFn({ subject: subject.unwrap(), ...common });
    }
    if (
      subject instanceof z.ZodEffects ||
      subject instanceof z.ZodTransformer
    ) {
      return originalFn({ subject: subject.innerType(), ...common });
    }
    if (subject instanceof z.ZodRecord) {
      return originalFn({ subject: subject.valueSchema, ...common });
    }
    if (subject instanceof z.ZodArray) {
      return originalFn({ subject: subject.element, ...common });
    }
    if (subject instanceof z.ZodDefault) {
      return originalFn({ subject: subject._def.innerType, ...common });
    }
    return false;
  };

  bench(
    "original",
    () => {
      originalFn({ subject: testedSchema, condition: testedCondition });
    },
    { time: 15000 },
  );

  bench(
    "featured",
    () => {
      hasNestedSchema({ subject: testedSchema, condition: testedCondition });
    },
    { time: 15000 },
  );
});
