import { combinations } from "./common-helpers";
import { z } from "zod/v4";
import * as R from "ramda";

export const metaSymbol = Symbol.for("express-zod-api");

export interface Metadata {
  /** @override ZodDefault::_zod.def.defaultValue() in depictDefault */
  defaultLabel?: string;
  brand?: string | number | symbol;
}

export const mixExamples = <A extends z.ZodType, B extends z.ZodType>(
  src: A,
  dest: B,
): B => {
  const srcMeta = src.meta();
  const destMeta = dest.meta();
  if (!srcMeta?.examples) return dest; // ensures srcMeta[metaSymbol]
  const examples = combinations<z.output<A> & z.output<B>>(
    destMeta?.examples || [],
    srcMeta.examples || [],
    ([destExample, srcExample]) =>
      typeof destExample === "object" &&
      typeof srcExample === "object" &&
      destExample &&
      srcExample
        ? R.mergeDeepRight(destExample, srcExample)
        : srcExample, // not supposed to be called on non-object schemas
  );
  return dest.meta({ ...destMeta, examples });
};
