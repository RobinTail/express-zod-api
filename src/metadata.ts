import {z} from './index';

export const metaProp = 'expressZodApiMeta';
export type MetaProp = typeof metaProp;

export type MetaDef<T extends z.ZodTypeAny> = {
  [K in MetaProp]: {
    examples: z.input<T>[];
    description?: string;
  };
};
export type MetaKey = keyof MetaDef<any>[MetaProp];
export type MetaValue<T extends z.ZodTypeAny, K extends MetaKey> = Readonly<MetaDef<T>[MetaProp][K]>;

type ExampleSetter<T extends z.ZodTypeAny> = (example: z.input<T>) => WithMeta<T>;
type DescriptionSetter<T extends z.ZodTypeAny> = (description: string) => WithMeta<T>;
type WithMeta<T extends z.ZodTypeAny> = T & {
  _def: T['_def'] & MetaDef<T>;
  example: ExampleSetter<T>;
  description: DescriptionSetter<T>;
}

export const withMeta = <T extends z.ZodTypeAny>(schema: T) => {
  const def = schema._def as MetaDef<T>;
  def[metaProp] = { examples: [] };
  Object.defineProperties(schema, {
    example: {
      get: (): ExampleSetter<T> => (value) => {
        def[metaProp].examples.push(value);
        return schema as WithMeta<T>;
      }
    },
    description: {
      get: (): DescriptionSetter<T> => (value) => {
        def[metaProp].description = value;
        return schema as WithMeta<T>;
      }
    }
  });
  return schema as WithMeta<T>;
};

export const hasMeta = <T extends z.ZodTypeAny>(schema: T): schema is WithMeta<T> => {
  if (!(metaProp in schema._def)) {
    return false;
  }
  return typeof schema._def[metaProp] === 'object' && schema._def[metaProp] !== null;
};

export const copyMeta = <A extends z.ZodTypeAny, B extends z.ZodTypeAny>(src: A, dest: B): B | WithMeta<B> => {
  if (!hasMeta(src)) {
    return dest;
  }
  const def = dest._def as MetaDef<B>;
  def[metaProp] = src._def[metaProp];
  return dest;
};
