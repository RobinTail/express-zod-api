import { clone, mergeDeepRight } from "ramda";
import { z } from "zod";
import { combinations, isObject } from "./common-helpers";
import { ProprietaryKind } from "./proprietary-schemas";

export interface Metadata<T extends z.ZodTypeAny> {
  /**
   * @todo if the following PR merged, use native branding instead:
   * @link https://github.com/colinhacks/zod/pull/2860
   * */
  kind?: ProprietaryKind;
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
  metaProp in schema._def && isObject(schema._def[metaProp]);

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

export const proprietary = <T extends z.ZodTypeAny>(
  kind: ProprietaryKind,
  subject: T,
) => {
  const schema = withMeta(subject);
  schema._def[metaProp].kind = kind;
  return schema;
};

export const isProprietary = (schema: z.ZodTypeAny, kind: ProprietaryKind) =>
  getMeta(schema, "kind") === kind;

export const getExamples = <
  T extends z.ZodTypeAny,
  V extends "original" | "parsed" | undefined,
>({
  schema,
  variant = "original",
  validate = variant === "parsed",
}: {
  schema: T;
  /**
   * @desc examples variant: original or parsed
   * @example "parsed" — for the case when possible schema transformations should be applied
   * @default "original"
   * @override validate: variant "parsed" activates validation as well
   * */
  variant?: V;
  /**
   * @desc filters out the examples that do not match the schema
   * @default variant === "parsed"
   * */
  validate?: boolean;
}): ReadonlyArray<V extends "parsed" ? z.output<T> : z.input<T>> => {
  const examples = getMeta(schema, "examples") || [];
  if (!validate && variant === "original") {
    return examples;
  }
  const result: Array<z.input<T> | z.output<T>> = [];
  for (const example of examples) {
    const parsedExample = schema.safeParse(example);
    if (parsedExample.success) {
      result.push(variant === "parsed" ? parsedExample.data : example);
    }
  }
  return result;
};
