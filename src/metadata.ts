import { combinations } from "./common-helpers";
import { z } from "./index";
import { clone, mergeDeepRight } from "ramda";

export const metaProp = "expressZodApiMeta";
type MetaProp = typeof metaProp;

export type MetaDef<T extends z.ZodTypeAny> = {
  [K in MetaProp]: {
    examples: z.input<T>[];
  };
};
type MetaKey = keyof MetaDef<any>[MetaProp];
type MetaValue<T extends z.ZodTypeAny, K extends MetaKey> = Readonly<
  MetaDef<T>[MetaProp][K]
>;

type ExampleSetter<T extends z.ZodTypeAny> = (
  example: z.input<T>
) => WithMeta<T>;

/**
 * @desc fixes the incompatibility of the ZodObject.keyof() method introduced in v3.17.9
 * @todo remove it if/when it will be compatible
 */
type MetaFixForStrippedObject<T> = T extends z.ZodObject<any>
  ? T & { keyof: z.ZodObject<any>["keyof"] }
  : T;

type WithMeta<T extends z.ZodTypeAny> = MetaFixForStrippedObject<T> & {
  _def: T["_def"] & MetaDef<T>;
  example: ExampleSetter<T>;
};

/** @desc it's the same approach as in zod's .describe() */
const cloneSchemaForMeta = <T extends z.ZodTypeAny>(schema: T): WithMeta<T> => {
  const This = (schema as any).constructor;
  const def = clone(schema._def) as MetaDef<T>;
  def[metaProp] = def[metaProp] || { examples: [] };
  return new This({ ...def }) as WithMeta<T>;
};

export const withMeta = <T extends z.ZodTypeAny>(schema: T): WithMeta<T> => {
  const copy = cloneSchemaForMeta<T>(schema);
  Object.defineProperties(copy, {
    example: {
      get: (): ExampleSetter<T> => (value) => {
        const localCopy = withMeta<T>(copy);
        localCopy._def[metaProp].examples.push(value);
        return localCopy;
      },
    },
  });
  return copy;
};

export const hasMeta = <T extends z.ZodTypeAny>(
  schema: T
): schema is WithMeta<T> => {
  if (!(metaProp in schema._def)) {
    return false;
  }
  return (
    typeof schema._def[metaProp] === "object" && schema._def[metaProp] !== null
  );
};

export function getMeta<T extends z.ZodTypeAny, K extends MetaKey>(
  schema: T,
  meta: K
): MetaValue<T, K> | undefined {
  if (!hasMeta(schema)) {
    return undefined;
  }
  const def = schema._def as MetaDef<T>;
  return meta in def[metaProp] ? def[metaProp][meta] : undefined;
}

export const copyMeta = <A extends z.ZodTypeAny, B extends z.ZodTypeAny>(
  src: A,
  dest: B
): B | WithMeta<B> => {
  if (!hasMeta(src)) {
    return dest;
  }
  const result = withMeta(dest);
  const examplesCombinations = combinations<B>(
    result._def[metaProp].examples,
    src._def[metaProp].examples
  );
  result._def[metaProp].examples = []; // if added more meta, restore mergeDeepRight
  if (examplesCombinations.type === "single") {
    result._def[metaProp].examples = examplesCombinations.value;
  } else {
    for (const [destExample, srcExample] of examplesCombinations.value) {
      result._def[metaProp].examples.push(
        mergeDeepRight({ ...destExample }, { ...srcExample })
      );
    }
  }
  return result;
};
