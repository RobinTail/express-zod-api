import { combinations } from "./common-helpers";
import { z } from "zod";
import { clone, mergeDeepRight } from "ramda";

export interface Metadata<T extends z.ZodTypeAny> {
  examples: z.input<T>[];
}

export const metaProp = "expressZodApiMeta";

type ExampleSetter<T extends z.ZodTypeAny> = (
  example: z.input<T>,
) => WithMeta<T>;

type WithMeta<T extends z.ZodTypeAny> = T & {
  _def: T["_def"] & Record<typeof metaProp, Metadata<T>>;
  example: ExampleSetter<T>;
};

/** @link https://github.com/colinhacks/zod/blob/3e4f71e857e75da722bd7e735b6d657a70682df2/src/types.ts#L485 */
const cloneSchema = <T extends z.ZodTypeAny>(schema: T) =>
  schema.describe(schema.description as string);

export const withMeta = <T extends z.ZodTypeAny>(schema: T): WithMeta<T> => {
  const copy = cloneSchema(schema) as WithMeta<T>;
  copy._def[metaProp] = // clone for deep copy, issue #827
    clone(copy._def[metaProp]) || ({ examples: [] } satisfies Metadata<T>);
  return Object.defineProperties(copy, {
    example: {
      get: (): ExampleSetter<T> => (value) => {
        const localCopy = withMeta<T>(copy);
        (localCopy._def[metaProp] as Metadata<T>).examples.push(value);
        return localCopy;
      },
    },
  });
};

export const hasMeta = <T extends z.ZodTypeAny>(
  schema: T,
): schema is WithMeta<T> =>
  z.object({ [metaProp]: z.object({}) }).safeParse(schema._def).success;

export const getMeta = <T extends z.ZodTypeAny, K extends keyof Metadata<T>>(
  schema: T,
  meta: K,
): Readonly<Metadata<T>[K]> | undefined =>
  hasMeta(schema) ? schema._def[metaProp][meta] : undefined;

export const copyMeta = <A extends z.ZodTypeAny, B extends z.ZodTypeAny>(
  src: A,
  dest: B,
): B | WithMeta<B> => {
  if (!hasMeta(src)) {
    return dest;
  }
  const result = withMeta(dest);
  result._def[metaProp].examples = combinations(
    result._def[metaProp].examples,
    src._def[metaProp].examples,
    ([destExample, srcExample]) =>
      typeof destExample === "object" && typeof srcExample === "object"
        ? mergeDeepRight({ ...destExample }, { ...srcExample })
        : srcExample, // not supposed to be called on non-object schemas
  );
  return result;
};
