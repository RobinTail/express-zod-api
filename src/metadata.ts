import {z} from './index';

// example value is always for the schema input
// output example (for the response) will be generated automatically: @see getExamples()
type ExampleProp<T extends z.ZodTypeAny> = z.input<T>;
type DescriptionProp = string;

export const metaProp = 'expressZodApiMeta';
export type MetaProp = typeof metaProp;

export type MetadataDef<T extends z.ZodTypeAny> = {
  [K in MetaProp]: {
    examples: ExampleProp<T>[];
    description?: DescriptionProp;
  };
};

type ExampleSetter<T extends z.ZodTypeAny> = (example: ExampleProp<T>) => WithMeta<T>;
type DescriptionSetter<T extends z.ZodTypeAny> = (description: DescriptionProp) => WithMeta<T>;
type WithMeta<T extends z.ZodTypeAny> = T & {
  example: ExampleSetter<T>;
  description: DescriptionSetter<T>;
  _def: T['_def'] & MetadataDef<T>;
}

// @see https://github.com/RobinTail/express-zod-api/discussions/165

export const withMeta = <T extends z.ZodTypeAny>(schema: T) => {
  const def = schema._def as MetadataDef<T>;
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
  const def = dest._def as MetadataDef<B>;
  def[metaProp] = src._def[metaProp];
  return dest;
};
