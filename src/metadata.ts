import {z} from './index';

// @todo this depends on IO, perhaps I need two parameters here
type ExampleProp<T extends z.ZodTypeAny> = T['_output'] | T['_input'];
type DescriptionProp = string;

export interface MetadataDef<T extends z.ZodTypeAny> {
  expressZodApiMeta: {
    example?: ExampleProp<T>;
    description?: DescriptionProp;
  }
}

type WithMeta<T extends z.ZodTypeAny> = T & {
  example: (example: ExampleProp<T>) => WithMeta<T>;
  description: (description: DescriptionProp) => WithMeta<T>;
  _def: T['_def'] & MetadataDef<T>;
}

// @see https://github.com/RobinTail/express-zod-api/discussions/165

export const withMeta = <T extends z.ZodTypeAny>(schema: T) => {
  schema._def.expressZodApiMeta = {};
  Object.defineProperties(schema, {
    example: {
      get() {
        return (value: ExampleProp<T>) => {
          this._def.expressZodApiMeta.example = value;
          return this;
        };
      }
    },
    description: {
      get() {
        return (value: DescriptionProp) => {
          this._def.expressZodApiMeta.description = value;
          return this;
        };
      }
    }
  });
  return schema as WithMeta<T>;
};
