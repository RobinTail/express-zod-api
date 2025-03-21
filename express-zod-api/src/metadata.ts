import { combinations } from "./common-helpers";
import { z } from "zod";
import * as R from "ramda";

export const metaSymbol = Symbol.for("express-zod-api");

export interface Metadata {
  examples: unknown[];
  /** @override ZodDefault::_def.defaultValue() in depictDefault */
  defaultLabel?: string;
  brand?: string | number | symbol;
  isDeprecated?: boolean;
}

/** @link https://github.com/colinhacks/zod/blob/3e4f71e857e75da722bd7e735b6d657a70682df2/src/types.ts#L485 */
export const cloneSchema = <T extends z.ZodType>(schema: T) => {
  const copy = schema.describe(schema.description as string);
  copy._def[metaSymbol] = // clone for deep copy, issue #827
    R.clone(copy._def[metaSymbol]) || ({ examples: [] } satisfies Metadata);
  return copy;
};

export const copyMeta = <A extends z.ZodType, B extends z.ZodType>(
  src: A,
  dest: B,
): B => {
  if (!(metaSymbol in src._def)) return dest; // ensure metadata in src below
  const result = cloneSchema(dest); // ensures metadata in result below
  result._def[metaSymbol]!.examples = combinations(
    result._def[metaSymbol]!.examples,
    src._def[metaSymbol]!.examples,
    ([destExample, srcExample]) =>
      typeof destExample === "object" && typeof srcExample === "object"
        ? R.mergeDeepRight({ ...destExample }, { ...srcExample })
        : srcExample, // not supposed to be called on non-object schemas
  );
  return result;
};
