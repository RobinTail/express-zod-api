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
 * @since zod 3.25.44 can be an object
 * @link https://github.com/colinhacks/zod/pull/4586
 * @since zod 3.25.68 and 4.0.0 was completely removed
 * @link https://github.com/colinhacks/zod/commit/ee5615d76b93aac15d7428a17b834a062235f6a1
 * */
export const getExamples = (subject: $ZodType): ReadonlyArray<unknown> => {
  const { examples, example } = globalRegistry.get(subject) || {};
  if (examples) {
    return Array.isArray(examples)
      ? examples
      : /** @todo remove this branch in v25 */
        Object.values(examples)
          .filter((one) => isObject(one) && "value" in one)
          .map(({ value }) => value);
  }
  /** @todo remove this in v25 */
  return example === undefined ? [] : [example];
};
