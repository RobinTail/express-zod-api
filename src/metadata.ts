import {combinations} from './helpers';
import {z} from './index';
import deepMerge from 'lodash.merge';

export const metaProp = 'expressZodApiMeta';
type MetaProp = typeof metaProp;

export type MetaDef<T extends z.ZodTypeAny> = {
  [K in MetaProp]: {
    examples: z.input<T>[];
  };
};
type MetaKey = keyof MetaDef<any>[MetaProp];
type MetaValue<T extends z.ZodTypeAny, K extends MetaKey> = Readonly<MetaDef<T>[MetaProp][K]>;

type ExampleSetter<T extends z.ZodTypeAny> = (example: z.input<T>) => WithMeta<T>;
type WithMeta<T extends z.ZodTypeAny> = T & {
  _def: T['_def'] & MetaDef<T>;
  example: ExampleSetter<T>;
}

export const withMeta = <T extends z.ZodTypeAny>(schema: T) => {
  const def = schema._def as MetaDef<T>;
  def[metaProp] = def[metaProp] || { examples: [] };
  if (!('example' in schema)) {
    Object.defineProperties(schema, {
      example: {
        get: (): ExampleSetter<T> => (value) => {
          def[metaProp].examples.push(value);
          return schema as WithMeta<T>;
        }
      }
    });
  }
  return schema as WithMeta<T>;
};

export const hasMeta = <T extends z.ZodTypeAny>(schema: T): schema is WithMeta<T> => {
  if (!(metaProp in schema._def)) {
    return false;
  }
  return typeof schema._def[metaProp] === 'object' && schema._def[metaProp] !== null;
};

export function getMeta<T extends z.ZodTypeAny, K extends MetaKey>(schema: T, meta: K): MetaValue<T, K> | undefined {
  if (!hasMeta(schema)) {
    return undefined;
  }
  const def = schema._def as MetaDef<T>;
  return meta in def[metaProp] ? def[metaProp][meta] : undefined;
}

export const copyMeta = <A extends z.ZodTypeAny, B extends z.ZodTypeAny>(src: A, dest: B): B | WithMeta<B> => {
  if (!hasMeta(src)) {
    return dest;
  }
  dest = withMeta(dest);
  const def = dest._def as MetaDef<B>;
  const examplesCombinations = combinations(def[metaProp].examples, src._def[metaProp].examples);
  // general deep merge except examples
  def[metaProp] = deepMerge(
    { ...def[metaProp], examples: [] },
    { ...src._def[metaProp], examples: [] }
  );
  if (examplesCombinations.type === 'single') {
    def[metaProp].examples = examplesCombinations.value;
  } else {
    for (const [destExample, srcExample] of examplesCombinations.value) {
      def[metaProp].examples.push(
        deepMerge({...destExample}, {...srcExample})
      );
    }
  }
  return dest;
};
