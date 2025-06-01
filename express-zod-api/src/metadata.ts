import { globalRegistry } from "zod/v4";
import type { $ZodType } from "zod/v4/core";
import { isObject } from "./common-helpers";

export const metaSymbol = Symbol.for("express-zod-api");

export const getBrand = (subject: $ZodType) => {
  const { brand } = subject._zod.bag || {};
  if (
    typeof brand === "symbol" ||
    typeof brand === "string" ||
    typeof brand === "number"
  )
    return brand;
  return undefined;
};

/**
 * @since zod 3.25.44
 * @link https://github.com/colinhacks/zod/pull/4586
 * */
export const getExamples = (subject: $ZodType): ReadonlyArray<unknown> => {
  const { examples = [], example } = globalRegistry.get(subject) || {};
  if (Array.isArray(examples)) return examples;
  if (isObject(examples)) return Object.values(examples);
  return example === undefined ? [] : [example];
};
