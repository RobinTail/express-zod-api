import {z} from './index';

interface Metadata<T extends z.ZodTypeAny> {
  description?: string;
  example?: T['_output'] | T['_input']; // @todo this depends on IO, perhaps I need two parameters here
}

type ExtendedDefinition<D extends z.ZodTypeDef, M extends Metadata<any>> = D & {meta: M};

// @see https://github.com/RobinTail/express-zod-api/discussions/165

const withMeta = <T extends z.ZodTypeAny>(schema: T, meta: Metadata<T>) => {
  schema._def.meta = meta;
  return schema as unknown as
    T extends z.ZodType<infer O, infer D, infer I>
      ? z.ZodType<O, ExtendedDefinition<D, typeof meta>, I>
      : never;
};

// usage:

const myType = withMeta(
  z.object({
    id: z.string()
  }),
  {
    description: '...',
    example: {
      id: 'XZC'
    }
  }
);
