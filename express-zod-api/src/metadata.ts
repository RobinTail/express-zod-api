import type {
  brandProperty as brandProp,
  asyncProperty as asyncProp,
} from "@express-zod-api/zod-plugin/shared";
import { globalRegistry, type z } from "zod";

export const brandProperty = "x-brand" satisfies typeof brandProp;
export const asyncProperty = "x-async" satisfies typeof asyncProp;

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

export const isAsync = (subject: z.core.$ZodType) =>
  globalRegistry.get(subject)?.[asyncProperty] === true;

/** @desc Returns examples from the schema metadata always as an array */
export const getExamples = (subject: z.core.$ZodType): unknown[] => {
  const { examples } = globalRegistry.get(subject) || {};
  if (Array.isArray(examples)) return examples;
  return [];
};
