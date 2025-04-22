import { combinations } from "./common-helpers";
import { z } from "zod";
import * as R from "ramda";

export const metaSymbol = Symbol.for("express-zod-api");

export type Metadata = {
  examples: unknown[]; // @todo try z.$input[] instead
  /** @override ZodDefault::_zod.def.defaultValue() in depictDefault */
  defaultLabel?: string;
  brand?: string | number | symbol;
};

export const ezRegistry = z.registry<Metadata>();

export const mixExamples = <A extends z.ZodType, B extends z.ZodType>(
  src: A,
  dest: B,
): B => {
  const srcMeta = ezRegistry.get(src);
  const destMeta = ezRegistry.get(dest);
  if (!srcMeta) return dest; // ensures srcMeta.examples below
  const examples = combinations(
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
  return dest.clone().register(ezRegistry, { ...destMeta, examples });
};
