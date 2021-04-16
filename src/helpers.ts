import {Request} from 'express';
import {z} from 'zod';
import {MiddlewareDefinition} from './middleware';

export type FlatObject = Record<string, any>;
export type ObjectSchema = z.AnyZodObject;

export type Merge<A extends ObjectSchema, B extends ObjectSchema | any> = z.ZodObject<
  // eslint-disable-next-line @typescript-eslint/ban-types
  A['shape'] & (B extends ObjectSchema ? B['shape'] : {}),
  A['_unknownKeys'],
  A['_catchall']
>;

export function combineEndpointAndMiddlewareInputSchemas<IN extends ObjectSchema, mIN>(
  input: IN,
  middlewares: MiddlewareDefinition<any, any, any>[]
): Merge<IN, mIN> {
  if (middlewares.length === 0) {
    return input as any as Merge<IN, mIN>;
  }
  return middlewares
    .map((middleware) => middleware.input)
    .reduce((carry: ObjectSchema, schema) => carry.merge(schema))
    .merge(input) as Merge<IN, mIN>;
}

export function getInitialInput(request: Request): any {
  switch (request.method) {
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return request.body;
    case 'GET':
      return request.query;
    case 'DELETE': // _may_ have body
    default:
      return {...request.query, ...request.body};
  }
}
