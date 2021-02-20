import * as z from 'zod';
import {MiddlewareDefinition} from './middleware';

export type ObjectSchema<T extends z.ZodRawShape> = z.ZodObject<T, "passthrough" | "strict" | "strip">;
export type Unshape<T> = T extends z.ZodRawShape ? z.infer<ObjectSchema<T>> : T;
export type JoinUnshaped<A, B> = Unshape<A> & Unshape<B>;

export function combineEndpointAndMiddlewareInputSchemas<IN extends z.ZodRawShape, mIN>(
  input: ObjectSchema<IN>,
  middlewares: MiddlewareDefinition<any, any, any>[]
): ObjectSchema<IN & mIN> {
  if (middlewares.length === 0) {
    return input as any as ObjectSchema<IN & mIN>;
  }
  return middlewares
    .map((middleware) => middleware.input)
    .reduce((carry, schema) => carry.merge(schema))
    .merge(input) as ObjectSchema<IN & mIN>;
}
