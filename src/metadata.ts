import { combinations } from "./common-helpers";
import { z } from "./index";
import { mergeDeepRight } from "ramda";

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

const cloneSchemaForMeta = <T extends z.ZodTypeAny>(schema: T): WithMeta<T> => {
  const This = (schema as any).constructor;
  const def = { ...schema._def } as MetaDef<T>;
  def[metaProp] = def[metaProp] || { examples: [] };
  return new This({ ...def }) as WithMeta<T>;
};

export const withMeta = <T extends z.ZodTypeAny>(schema: T): WithMeta<T> => {
  const result = cloneSchemaForMeta<T>(schema);

  Object.defineProperties(result, {
    example: {
      get: (): ExampleSetter<T> => (value) => {
        const result2 = withMeta<T>(result);
        result2._def[metaProp].examples.push(value);
        return result2;
      },
    },
  });

  return result;
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
  dest = withMeta(dest);
  const def = dest._def as MetaDef<B>;
  const examplesCombinations = combinations(
    def[metaProp].examples,
    src._def[metaProp].examples
  );
  // general deep merge except examples
  def[metaProp] = mergeDeepRight(
    { ...def[metaProp], examples: [] },
    { ...src._def[metaProp], examples: [] }
  );
  if (examplesCombinations.type === "single") {
    def[metaProp].examples = examplesCombinations.value;
  } else {
    for (const [destExample, srcExample] of examplesCombinations.value) {
      def[metaProp].examples.push(
        mergeDeepRight({ ...destExample }, { ...srcExample })
      );
    }
  }
  return dest;
};
