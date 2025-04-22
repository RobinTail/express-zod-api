import { combinations } from "./common-helpers";
import { z } from "zod";
import * as R from "ramda";

export const metaSymbol = Symbol.for("express-zod-api");

export type Metadata = {
  examples: unknown[]; // @todo make it z.$input
  /** @override ZodDefault::_zod.def.defaultValue() in depictDefault */
  defaultLabel?: string;
  brand?: string | number | symbol;
};

export const metaRegistry = z.registry<Metadata>();

export const copyMeta = <A extends z.ZodType, B extends z.ZodType>(
  src: A,
  dest: B,
): B => {
  const srcMeta = metaRegistry.get(src);
  const destMeta = metaRegistry.get(dest);
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
