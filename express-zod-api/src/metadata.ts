import { globalRegistry } from "zod/v4";
import type { $ZodType } from "zod/v4/core";

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
  const { examples, example } = globalRegistry.get(subject) || {};
  if (examples) {
    return Array.isArray(examples)
      ? examples
      : Object.values(examples).map(({ value }) => value);
  }
  return example === undefined ? [] : [example];
};
