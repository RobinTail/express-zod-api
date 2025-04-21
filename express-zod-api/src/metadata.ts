import { combinations } from "./common-helpers";
import { z } from "zod";
import * as R from "ramda";

export const metaSymbol = Symbol.for("express-zod-api");

export interface Metadata {
  /** @override ZodDefault::_zod.def.defaultValue() in depictDefault */
  defaultLabel?: string;
  brand?: string | number | symbol;
}

export const copyMeta = <A extends z.ZodType, B extends z.ZodType>(
  src: A,
  dest: B,
): B => {
  const srcMeta = src.meta();
  const destMeta = dest.meta();
  if (!srcMeta) return dest; // ensure metadata in src below
  return dest.meta({
    description: dest.description,
    examples: combinations(
      destMeta?.examples || [],
      srcMeta.examples || [],
      ([destExample, srcExample]) =>
        typeof destExample === "object" &&
        typeof srcExample === "object" &&
        destExample &&
        srcExample
          ? R.mergeDeepRight(destExample, srcExample)
          : srcExample, // not supposed to be called on non-object schemas
    ),
    [metaSymbol]: destMeta?.[metaSymbol],
  });
};
