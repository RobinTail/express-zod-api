import * as R from "ramda";
import { z } from "zod";
import { combinations } from "./common-helpers";

export const metaSymbol = Symbol.for("express-zod-api");

export interface Metadata {
  examples: unknown[];
  /** @override ZodDefault::_zod.def.defaultValue() in depictDefault */
  defaultLabel?: string;
  brand?: string | number | symbol;
  isDeprecated?: boolean;
}

export const copyMeta = <A extends z.ZodType, B extends z.ZodType>(
  src: A,
  dest: B,
): B => {
  const srcMeta = src.meta()?.[metaSymbol];
  const destMeta = dest.meta()?.[metaSymbol];
  if (!srcMeta) return dest; // ensure metadata in src below

  return dest.meta({
    description: dest.description,
    [metaSymbol]: {
      ...destMeta,
      examples: combinations(
        destMeta?.examples || [],
        srcMeta.examples || [],
        ([destExample, srcExample]) =>
          typeof destExample === "object" && typeof srcExample === "object"
            ? R.mergeDeepRight({ ...destExample }, { ...srcExample })
            : srcExample, // not supposed to be called on non-object schemas
      ),
    },
  });
};
