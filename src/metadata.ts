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
  const schemaWithMeta = schema as WithMeta<T>;
  schemaWithMeta._def[metadataProp] = {};
  Object.defineProperties(schemaWithMeta, {
    example: {
      get: (): ExampleSetter<T> => (value) => {
        schemaWithMeta._def[metadataProp].example = value;
        return schemaWithMeta;
      }
    },
    description: {
      get: (): DescriptionSetter<T> => (value) => {
        schemaWithMeta._def[metadataProp].description = value;
        return schemaWithMeta;
      }
    }
  });
  return schemaWithMeta;
};
