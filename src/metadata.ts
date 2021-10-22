import {z} from './index';

// @todo this depends on IO, perhaps I need two parameters here
type ExampleProp<T extends z.ZodTypeAny> = T['_output'] | T['_input'];
type DescriptionProp = string;

export const metadataProp = 'expressZodApiMeta';

export type MetadataDef<T extends z.ZodTypeAny> = {
  [K in typeof metadataProp]: {
    example?: ExampleProp<T>;
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
  def[metadataProp] = {};
  Object.defineProperties(schema, {
    example: {
      get: (): ExampleSetter<T> => (value) => {
        def[metadataProp].example = value;
        return schema as WithMeta<T>;
      }
    },
    description: {
      get: (): DescriptionSetter<T> => (value) => {
        def[metadataProp].description = value;
        return schema as WithMeta<T>;
      }
    }
  });
  return schema as WithMeta<T>;
};
