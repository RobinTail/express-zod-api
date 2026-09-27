import type { brandProperty as brandProp } from "@express-zod-api/zod-plugin/brand";
import { globalRegistry, type z } from "zod";

export const brandProperty = "x-brand" satisfies typeof brandProp;

export const getBrand = (subject: z.core.$ZodType) => {
  const { [brandProperty]: brand } = globalRegistry.get(subject) || {};
  if (
    typeof brand === "symbol" ||
    typeof brand === "string" ||
    typeof brand === "number"
  )
    return brand;
  return undefined;
};

/** @desc Returns examples from the schema metadata always as an array */
export const getExamples = (subject: z.core.$ZodType): unknown[] => {
  const { examples } = globalRegistry.get(subject) || {};
  if (Array.isArray(examples)) return examples;
  return [];
};

/** @desc Finds the schema having the id metadata: the given one or its origin (clones and compiled ones omit it) */
export const findIdentified = (
  subject: z.core.$ZodType,
): { id: string; schema: z.core.$ZodType } | undefined => {
  const { id } = globalRegistry.get(subject) || {};
  if (id) return { id, schema: subject };
  return subject._zod.parent && findIdentified(subject._zod.parent);
};
