import * as R from "ramda";
import { z } from "zod";
import { combinations } from "./common-helpers";

export const metaSymbol = Symbol.for("express-zod-api");

// @todo mv to plugin
declare module "@zod/core" {
  interface GlobalMeta {
    [metaSymbol]?: Metadata;
  }
}

export interface Metadata {
  examples: unknown[];
  /** @override ZodDefault::_def.defaultValue() in depictDefault */
  defaultLabel?: string;
  brand?: string | number | symbol;
  isDeprecated?: boolean;
}

/**
 * @link https://github.com/colinhacks/zod/blob/3e4f71e857e75da722bd7e735b6d657a70682df2/src/types.ts#L485
 * @todo probably no longer needed
 * */
export const cloneSchema = <T extends z.ZodType>(schema: T) =>
  schema.meta({
    description: schema.description,
    // clone for deep copy, issue #827
    [metaSymbol]: R.clone(schema.meta()?.[metaSymbol]) || { examples: [] },
  });

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
      ...(destMeta || {}),
      examples: combinations(
        srcMeta.examples || [],
        destMeta?.examples || [],
        ([destExample, srcExample]) =>
          typeof destExample === "object" && typeof srcExample === "object"
            ? R.mergeDeepRight({ ...destExample }, { ...srcExample })
            : srcExample, // not supposed to be called on non-object schemas
      ),
    },
  });
};
