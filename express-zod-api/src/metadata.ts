import type { $ZodType, $ZodObject } from "zod/v4/core";
import { combinations, isSchema, pullExampleProps } from "./common-helpers";
import { z } from "zod/v4";
import * as R from "ramda";

export const metaSymbol = Symbol.for("express-zod-api");

export const mixExamples = <A extends z.ZodType, B extends z.ZodType>(
  src: A,
  dest: B,
): B => {
  const srcExamples =
    src.meta()?.examples ||
    (isSchema<$ZodObject>(src, "object") ? pullExampleProps(src) : undefined);
  if (!srcExamples?.length) return dest;
  const destMeta = dest.meta();
  const examples = combinations<z.output<A> & z.output<B>>(
    destMeta?.examples || [],
    srcExamples,
    ([destExample, srcExample]) =>
      typeof destExample === "object" &&
      typeof srcExample === "object" &&
      destExample &&
      srcExample
        ? R.mergeDeepRight(destExample, srcExample)
        : srcExample, // not supposed to be called on non-object schemas
  );
  return dest.meta({ ...destMeta, examples }); // @todo might not be required to spread since .meta() does it now
};

export const getBrand = (subject: $ZodType) => {
  const { brand } = subject._zod.bag;
  if (
    typeof brand === "symbol" ||
    typeof brand === "string" ||
    typeof brand === "number"
  )
    return brand;
  return undefined;
};
